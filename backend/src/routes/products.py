from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ..db import get_session
from ..models import PriceHistory, ProductRef

router = APIRouter()


@router.get("/products/{product_id}")
def get_product(product_id: str):
    """Fiche produit : référence (nom, URL marchande) + dernier prix observé."""
    if len(product_id) > 500:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    with get_session() as session:
        ref = session.get(ProductRef, product_id)
        last = session.exec(
            select(PriceHistory)
            .where(PriceHistory.product_id == product_id)
            .order_by(PriceHistory.observed_at.desc())
            .limit(1)
        ).first()
    if not ref and not last:
        raise HTTPException(status_code=404, detail="Produit inconnu")
    return {
        "id": product_id,
        "name": ref.name if ref else "",
        "sourceUrl": ref.source_url if ref else "",
        "siteDomain": ref.site_domain if ref else (last.connector if last else ""),
        "lastPrice": last.price if last else None,
        "lastSeen": last.observed_at.isoformat() if last else None,
    }
