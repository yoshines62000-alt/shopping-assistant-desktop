from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..settings_store import get_app_settings, update_app_settings

router = APIRouter()


class SettingsUpdate(BaseModel):
    platformFees: Optional[dict[str, float]] = None
    discordWebhookUrl: Optional[str] = Field(default=None, max_length=500)
    alertCheckMinutes: Optional[int] = Field(default=None, ge=5, le=1440)
    reestimateDays: Optional[int] = Field(default=None, ge=1, le=90)


@router.get("/settings")
def read_settings():
    return get_app_settings()


@router.put("/settings")
def write_settings(body: SettingsUpdate):
    fees = body.platformFees
    if fees is not None:
        for platform, rate in fees.items():
            if not 0 <= rate <= 0.9:
                raise HTTPException(status_code=400, detail=f"Taux invalide pour {platform}: {rate}")
    url = body.discordWebhookUrl
    if url and not url.startswith("https://discord.com/api/webhooks/"):
        raise HTTPException(status_code=400, detail="URL de webhook Discord invalide")
    return update_app_settings(body.model_dump(exclude_none=True))
