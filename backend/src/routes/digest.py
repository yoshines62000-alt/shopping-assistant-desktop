from fastapi import APIRouter
from sqlmodel import select
from datetime import datetime, timezone, timedelta
from ..db import get_session
from ..models import PriceHistory, ProductRef

router = APIRouter()

@router.get("/digest/daily")
def get_daily_digest(hours: int = 24):
    """Rapport quotidien des baisses de prix pour les produits suivis."""
    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=hours)
    drops = []
    seen = set()
    with get_session() as session:
        histories = session.exec(
            select(PriceHistory)
            .where(PriceHistory.observed_at >= since)
            .order_by(PriceHistory.observed_at.desc())
            .limit(100)
        ).all()

        for h in histories:
            if h.product_id in seen:
                continue
            ref = session.get(ProductRef, h.product_id)
            if not ref:
                continue
            prev = session.exec(
                select(PriceHistory)
                .where(PriceHistory.product_id == h.product_id)
                .where(PriceHistory.observed_at < h.observed_at)
                .order_by(PriceHistory.observed_at.desc())
                .limit(1)
            ).first()
            if prev and h.price < prev.price:
                drops.append({
                    "product": ref.name,
                    "site": ref.site_domain,
                    "oldPrice": prev.price,
                    "newPrice": h.price,
                    "diff": round(prev.price - h.price, 2),
                    "url": ref.source_url,
                })
                seen.add(h.product_id)

    return {
        "generatedAt": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
        "priceDrops": drops[:20],
        "count": len(drops),
    }