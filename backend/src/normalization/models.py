from pydantic import BaseModel
from typing import Any, Optional


class ProductNormalized(BaseModel):
    name: str
    total_price: float
    currency: str = "EUR"
    rating: Optional[float] = None
    review_count: Optional[int] = None
    delivery_days: Optional[int] = None
    site_domain: str
    source_url: str
    seller: Optional[str] = None
    in_stock: bool = True
    raw: dict[str, Any] = {}

    model_config = {"extra": "forbid"}
