from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..estimation.engine import estimate_resale

router = APIRouter()


class EstimateRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=200)
    purchasePrice: Optional[float] = Field(default=None, ge=0)
    platform: str = Field(default="ebay", max_length=50)


@router.post("/estimate")
def estimate(body: EstimateRequest):
    return estimate_resale(body.query.strip(), body.purchasePrice, body.platform)
