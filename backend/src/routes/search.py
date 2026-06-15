import json
import logging
import asyncio
import hashlib
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Any, Optional
from ..config import get_settings
from ..connectors import health
from ..connectors.registry import CONNECTORS
from ..normalization.engine import NormalizationEngine
from ..scoring.engine import ScoringEngine, ScoringWeights

logger = logging.getLogger("routes.search")
router = APIRouter()

normalizer = NormalizationEngine()
scorer = ScoringEngine()

settings = get_settings()
CACHE_TTL = settings.cache_ttl_seconds

redis_client = None

def get_redis():
    global redis_client
    if redis_client is None:
        try:
            import redis.asyncio as redis
            redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        except Exception as e:
            logger.warning("Redis not available: %s", e)
    return redis_client

def _product_id(source_url: str) -> str:
    return hashlib.sha256(source_url.encode("utf-8")).hexdigest()

def _to_camel(data: dict[str, Any]) -> dict[str, Any]:
    source_url = data.get("source_url", "")
    return {
        "id": _product_id(source_url),
        "name": data.get("name", ""),
        "totalPrice": data.get("total_price", 0.0),
        "currency": data.get("currency", "EUR"),
        "rating": data.get("rating"),
        "reviewCount": data.get("review_count"),
        "deliveryDays": data.get("delivery_days"),
        "siteDomain": data.get("site_domain", ""),
        "sourceUrl": source_url,
        "seller": data.get("seller"),
        "inStock": data.get("in_stock", True),
        "scores": data.get("scores"),
    }

_trust_cache: dict[str, float] | None = None

def _get_trust_scores() -> dict[str, float]:
    global _trust_cache
    if _trust_cache is None:
        try:
            from ..db import get_session
            from ..models import SiteReputation
            from sqlmodel import select
            with get_session() as session:
                rows = session.exec(select(SiteReputation)).all()
                _trust_cache = {r.domain: float(r.trust_score) for r in rows}
        except Exception as e:
            logger.warning("Trust list unavailable: %s", e)
            _trust_cache = {}
    return _trust_cache

# Un nouveau point d'historique par produit seulement si le prix a changé
# ou si la dernière observation date de plus de 12 h (sinon chaque recherche
# répétée créerait des doublons sans information).
_HISTORY_MIN_AGE_HOURS = 12


def _ingest_price_history(products: list[dict[str, Any]]) -> None:
    try:
        from datetime import datetime, timedelta, timezone

        from sqlmodel import select

        from ..db import get_session
        from ..models import PriceHistory, ProductRef

        valid = [p for p in products if p.get("sourceUrl") and float(p.get("totalPrice", 0.0)) > 0]
        if not valid:
            return
        ids = [p["id"] for p in valid]
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
            hours=_HISTORY_MIN_AGE_HOURS
        )

        with get_session() as session:
            # Dernière observation connue par produit
            last: dict[str, PriceHistory] = {}
            for row in session.exec(
                select(PriceHistory)
                .where(PriceHistory.product_id.in_(ids))
                .order_by(PriceHistory.observed_at.desc())
            ).all():
                last.setdefault(row.product_id, row)

            for p in valid:
                pid = p["id"]
                price = float(p["totalPrice"])
                prev = last.get(pid)
                if prev is None or prev.price != price or prev.observed_at < cutoff:
                    session.add(
                        PriceHistory(
                            product_id=pid, price=price, connector=p.get("siteDomain", "unknown")
                        )
                    )
                # Référence produit (upsert) : nécessaire aux alertes pour re-scraper
                ref = session.get(ProductRef, pid) or ProductRef(
                    product_id=pid, source_url=p["sourceUrl"]
                )
                ref.source_url = p["sourceUrl"]
                ref.name = p.get("name", "")[:300]
                ref.site_domain = p.get("siteDomain", "")
                session.add(ref)
            session.commit()
    except Exception as e:
        logger.warning("Price history ingest failed: %s", e)

def _dedupe(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in results:
        key = item.get("sourceUrl") or item.get("name", "")
        if key and key not in seen:
            seen.add(key)
            out.append(item)
        elif not key:
            out.append(item)
    return out

class SearchPayload(BaseModel):
    query: str = Field(default="", max_length=500)
    maxResults: Optional[int] = None
    max_results: Optional[int] = None
    offset: Optional[int] = None
    page: Optional[int] = None
    minPriceEur: Optional[float] = None
    maxPriceEur: Optional[float] = None
    maxDeliveryDays: Optional[float] = None
    minRating: Optional[float] = None
    site: Optional[str] = None
    connector: Optional[str] = None
    excludeKeywords: Optional[list[str]] = None
    weights: Optional[dict[str, float]] = None
    priority: Optional[str] = None
    keywords: Optional[list[str]] = None


_executor = ThreadPoolExecutor(max_workers=4)

def _cache_fingerprint(
    query: str,
    site_filter: str,
    min_price,
    max_price,
    max_days,
    min_rating,
    exclude_keywords: list[str],
    weights: ScoringWeights,
) -> str:
    return (
        f"{query}:{site_filter}:{min_price}:{max_price}"
        f":{max_days}:{min_rating}:{sorted(exclude_keywords)}:{weights}"
    )


@router.post("/search")
async def search_products(payload: SearchPayload) -> dict[str, Any]:
    query = str(payload.query or "").strip()
    raw_max = payload.maxResults if payload.maxResults is not None else payload.max_results
    offset_value = payload.offset if payload.offset is not None else payload.page
    if raw_max is None:
        raw_max = 5
    if offset_value is None:
        offset_value = 0
    try:
        max_results = int(raw_max)
        offset = int(offset_value)
    except Exception:
        max_results = 5
        offset = 0

    weights_raw = payload.weights
    try:
        weights = ScoringWeights(**weights_raw) if isinstance(weights_raw, dict) else ScoringWeights()
    except TypeError:
        weights = ScoringWeights()

    min_price = payload.minPriceEur
    max_price = payload.maxPriceEur
    max_days = payload.maxDeliveryDays
    min_rating = payload.minRating
    site_filter = str(payload.site or payload.connector or "").strip().lower()
    if site_filter == "all":
        site_filter = ""
    exclude_keywords = [
        str(k).strip().lower()
        for k in (payload.excludeKeywords or [])
        if str(k).strip()
    ]

    logger.info("search route hit: query=%s max=%s offset=%s", query, max_results, offset)
    if not query:
        return {"query": query, "results": [], "sources_queried": []}

    redis = get_redis()
    # La clé doit couvrir TOUS les paramètres qui changent la réponse, sinon
    # une recherche avec d'autres filtres resservirait un résultat obsolète.
    cache_fingerprint = _cache_fingerprint(
        query,
        site_filter,
        min_price,
        max_price,
        max_days,
        min_rating,
        exclude_keywords,
        weights,
    )
    cache_key = f"search:v3:{hashlib.md5(cache_fingerprint.encode()).hexdigest()}"

    if redis is not None:
        try:
            cached = await redis.get(cache_key)
            if cached:
                cached_body = json.loads(cached)
                results = cached_body.get("results", [])
                if offset > 0:
                    results = results[offset:]
                if max_results is not None:
                    results = results[:max_results]
                return {**cached_body, "results": results}
        except Exception as e:
            logger.debug("Redis cache read failed: %s", e)

    try:
        all_raw: list[Any] = []
        sources: list[str] = []
        
        fetch_count = max_results * 3
        
        async def run_connector(connector_cls):
            # Circuit breaker : on saute un connecteur qui bloque a repetition.
            if health.should_skip(connector_cls.site_key):
                logger.warning("connector %s ignore (circuit ouvert)", connector_cls.site_key)
                return ([], None)
            try:
                connector = connector_cls()
                loop = asyncio.get_running_loop()
                raw = await loop.run_in_executor(
                    _executor, lambda c=connector, q=query, m=fetch_count: c.search(q, max_results=m)
                )
                if raw:
                    logger.info("connector %s returned %d results", connector_cls.__name__, len(raw))
                    return (raw, connector.site_key)
                return ([], None)
            except Exception as exc:
                logger.error("connector %s failed: %s", connector_cls.__name__, exc)
                return ([], None)

        # Filtre par site : n'interroger que le connecteur demandé (économise
        # un lancement de navigateur pour les sources non sollicitées).
        selected = [
            c for c in CONNECTORS
            if not site_filter or c.site_key == site_filter
        ] or list(CONNECTORS)
        results_list = await asyncio.gather(*[run_connector(c) for c in selected])
        
        for raw, site_key in results_list:
            if raw:
                all_raw.extend(raw)
                sources.append(site_key)

        normalized = [
            p
            for p in normalizer.normalize_many(all_raw)
            if p.total_price > 0 and p.source_url.startswith("http")
        ]
        
        if min_price is not None:
            normalized = [p for p in normalized if p.total_price >= float(min_price)]
        if max_price is not None:
            normalized = [p for p in normalized if p.total_price <= float(max_price)]
        
        if min_rating is not None:
            normalized = [p for p in normalized if p.rating is not None and p.rating >= float(min_rating)]
        
        if max_days is not None:
            normalized = [p for p in normalized if p.delivery_days is None or p.delivery_days <= int(max_days)]

        if exclude_keywords:
            normalized = [
                p for p in normalized
                if not any(kw in p.name.lower() for kw in exclude_keywords)
            ]

        products = [p.model_dump() for p in normalized]
        trust = _get_trust_scores()
        for data in products:
            reputation = trust.get(data.get("site_domain", ""))
            if reputation is not None:
                data["site_reputation"] = reputation
        scored = scorer.score_many(products, weights)
        results: list[dict[str, Any]] = []
        for data, score in zip(products, scored):
            data["scores"] = {
                "price": round(score.price, 2),
                "delivery": round(score.delivery, 2),
                "reviews": round(score.reviews, 2),
                "site": round(score.site, 2),
                "popularity": round(score.popularity, 2),
                "final": round(score.final, 2),
            }
            results.append(_to_camel(data))
        results.sort(key=lambda x: x["scores"]["final"], reverse=True)
        results = _dedupe(results)

        # La clé de cache ignore volontairement la pagination (cf. test_search_cache) :
        # on met donc en cache le jeu COMPLET, et offset/max ne s'appliquent qu'à la
        # réponse. Sinon la page 2 resservie depuis le cache renvoyait une liste vide,
        # et chaque page re-scrapait inutilement.
        full_response = {"query": query, "results": results, "sources_queried": sources}

        if redis is not None:
            try:
                await redis.set(cache_key, json.dumps(full_response), ex=CACHE_TTL)
            except Exception as e:
                logger.debug("Redis cache write failed: %s", e)

        page = results[offset:] if offset > 0 else results
        if max_results > 0:
            page = page[:max_results]

        # L'ingestion d'historique fait des I/O DB synchrones : threadpool, sans
        # attendre, pour ne pas rallonger le temps de réponse de la recherche.
        loop = asyncio.get_running_loop()
        loop.run_in_executor(_executor, _ingest_price_history, list(page))

        return {**full_response, "results": page}
    except Exception as exc:
        logger.exception("search failed")
        # Invalidate cache on error so next request retries fresh
        if redis is not None:
            try:
                await redis.delete(cache_key)
            except Exception:
                pass
        return {"query": query, "results": [], "error": str(exc), "sources_queried": []}
