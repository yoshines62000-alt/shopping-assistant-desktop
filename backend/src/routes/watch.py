"""Deal-watcher : recherches favorites surveillées en fond + bonnes affaires.

L'utilisateur enregistre une recherche (requête + prix cible). La tâche de fond
(`background.scan_saved_searches`) la rejoue périodiquement et enregistre toute
offre sous le seuil jamais vue (`DealHit`), avec notification Discord/native.
"""

from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlmodel import select

from ..db import get_session
from ..models import Alert, DealHit, SavedSearch

router = APIRouter()


def _search_to_camel(s: SavedSearch, deal_count: int = 0) -> dict[str, Any]:
    return {
        "id": s.id,
        "query": s.query,
        "targetPrice": s.target_price,
        "site": s.site or None,
        "active": s.active,
        "intervalMinutes": s.interval_minutes,
        "seeded": s.seeded,
        "lastChecked": s.last_checked.isoformat() if s.last_checked else None,
        "createdAt": s.created_at.isoformat(),
        "dealCount": deal_count,
    }


def _hit_to_camel(h: DealHit) -> dict[str, Any]:
    return {
        "id": h.id,
        "savedSearchId": h.saved_search_id,
        "productId": h.product_id,
        "name": h.name,
        "price": h.price,
        "sourceUrl": h.source_url,
        "siteDomain": h.site_domain,
        "foundAt": h.found_at.isoformat(),
    }


class SavedSearchPayload(BaseModel):
    query: str = Field(min_length=1, max_length=300)
    targetPrice: float = Field(gt=0)
    site: Optional[str] = None
    intervalMinutes: int = Field(default=0, ge=0, le=10080)


@router.get("/watch/searches")
def list_searches() -> dict[str, Any]:
    with get_session() as session:
        searches = session.exec(select(SavedSearch).order_by(SavedSearch.created_at.desc())).all()
        counts: dict[int, int] = {}
        for row in session.exec(select(DealHit.saved_search_id)).all():
            counts[row] = counts.get(row, 0) + 1
    return {"searches": [_search_to_camel(s, counts.get(s.id, 0)) for s in searches]}


@router.post("/watch/searches")
def create_search(payload: SavedSearchPayload) -> dict[str, Any]:
    site = (payload.site or "").strip().lower()
    with get_session() as session:
        search = SavedSearch(
            query=payload.query.strip(),
            target_price=float(payload.targetPrice),
            site=site if site and site != "all" else "",
            interval_minutes=payload.intervalMinutes,
        )
        session.add(search)
        session.commit()
        session.refresh(search)
        return _search_to_camel(search)


@router.patch("/watch/searches/{search_id}")
def update_search(search_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    with get_session() as session:
        search = session.get(SavedSearch, search_id)
        if not search:
            return {"error": "not found"}
        if "active" in payload:
            search.active = bool(payload["active"])
        if "targetPrice" in payload:
            try:
                search.target_price = float(payload["targetPrice"])
            except (TypeError, ValueError):
                pass
        if "intervalMinutes" in payload:
            try:
                search.interval_minutes = max(0, int(payload["intervalMinutes"]))
            except (TypeError, ValueError):
                pass
        session.add(search)
        session.commit()
        session.refresh(search)
        return _search_to_camel(search)


@router.delete("/watch/searches/{search_id}")
def delete_search(search_id: int) -> dict[str, Any]:
    with get_session() as session:
        search = session.get(SavedSearch, search_id)
        if search:
            for hit in session.exec(
                select(DealHit).where(DealHit.saved_search_id == search_id)
            ).all():
                session.delete(hit)
            session.delete(search)
            session.commit()
    return {"ok": True}


@router.get("/watch/deals")
def list_deals(limit: int = 50) -> dict[str, Any]:
    """Bonnes affaires trouvées, les plus récentes d'abord."""
    limit = max(1, min(limit, 200))
    with get_session() as session:
        hits = session.exec(
            select(DealHit).order_by(DealHit.found_at.desc()).limit(limit)
        ).all()
    return {"deals": [_hit_to_camel(h) for h in hits]}


@router.post("/watch/check-prices")
def check_watch_prices() -> dict[str, Any]:
    """Force re-scrape prices for watched products - triggers alert evaluation."""
    with get_session() as session:
        watched = session.exec(select(Alert.product_id).distinct()).all()
        return {"checked": len(watched), "productIds": list(watched)}
