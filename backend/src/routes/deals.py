"""Chasse automatique aux bonnes affaires.

Pour une requête, réutilise tout le pipeline de recherche (connecteurs, scoring,
filtres) pour trouver les meilleures offres, puis estime *automatiquement* la
revente de chacune et calcule la marge nette. Le résultat est classé par marge
décroissante : les flips les plus rentables remontent en tête.

L'estimation de revente coûte ~20 s par offre (scrape des ventes eBay réussies),
donc on limite l'analyse aux N meilleures offres et on les traite en parallèle.
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import APIRouter

from ..estimation.engine import estimate_resale
from .search import SearchPayload, search_products

logger = logging.getLogger("routes.deals")
router = APIRouter()

# Pool dédié à l'estimation (distinct de celui des connecteurs) : chaque thread
# garde son propre navigateur Playwright persistant.
_pool = ThreadPoolExecutor(max_workers=4)

MAX_ANALYZE = 5


@router.post("/deals")
async def deals_scan(payload: dict[str, Any]) -> dict[str, Any]:
    query = str(payload.get("query") or "").strip()
    if not query:
        return {"query": query, "platform": "ebay", "deals": [], "sources_queried": []}

    try:
        analyze = int(payload.get("maxResults") or payload.get("analyze") or 3)
    except (TypeError, ValueError):
        analyze = 3
    analyze = max(1, min(analyze, MAX_ANALYZE))

    platform = str(payload.get("platform") or "ebay").strip().lower() or "ebay"

    # On demande un peu plus de candidats que ce qu'on estimera, pour analyser
    # les mieux notés. search_products applique déjà les filtres (prix, site...).
    search_payload = SearchPayload(**{**payload, "maxResults": max(analyze * 2, 6), "offset": 0})
    search_res = await search_products(search_payload)
    products = search_res.get("results", [])[:analyze]

    loop = asyncio.get_running_loop()

    async def estimate_one(product: dict[str, Any]) -> dict[str, Any]:
        name = (product.get("name") or "")[:80]
        price = float(product.get("totalPrice") or 0)
        est: dict[str, Any] | None
        try:
            est = await loop.run_in_executor(
                _pool, lambda: estimate_resale(name, price, platform)
            )
        except Exception as exc:
            logger.warning("Estimation revente échouée pour '%s' : %s", name, exc)
            est = None

        resale = None
        if est and est.get("sampleCount", 0) > 0 and est.get("median") is not None:
            resale = {
                "median": est.get("median"),
                "netEstimate": est.get("netEstimate"),
                "marginEur": est.get("estimatedProfit"),
                "marginPct": est.get("marginPct"),
                "sampleCount": est.get("sampleCount"),
                "platform": platform,
            }
        return {**product, "resale": resale}

    deals = list(await asyncio.gather(*[estimate_one(p) for p in products]))

    # Meilleures marges d'abord ; les offres sans estimation finissent en bas.
    def margin_key(d: dict[str, Any]) -> float:
        resale = d.get("resale")
        if resale and resale.get("marginEur") is not None:
            return float(resale["marginEur"])
        return float("-inf")

    deals.sort(key=margin_key, reverse=True)
    return {
        "query": query,
        "platform": platform,
        "deals": deals,
        "sources_queried": search_res.get("sources_queried", []),
    }
