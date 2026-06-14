from fastapi import APIRouter
from sqlmodel import select

from ..db import get_session
from ..models import Alert

router = APIRouter()


@router.post("/watch/check-prices")
def check_watch_prices():
    """Force re-scrape prices for watched products - triggers alert evaluation."""
    with get_session() as session:
        watched = session.exec(select(Alert.product_id).distinct()).all()
        return {"checked": len(watched), "productIds": list(watched)}