from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..notifications import notify_all
from ..settings_store import get_app_settings, update_app_settings

router = APIRouter()


class SettingsUpdate(BaseModel):
    platformFees: Optional[dict[str, float]] = None
    discordWebhookUrl: Optional[str] = Field(default=None, max_length=500)
    telegramBotToken: Optional[str] = Field(default=None, max_length=200)
    telegramChatId: Optional[str] = Field(default=None, max_length=64)
    smtpHost: Optional[str] = Field(default=None, max_length=200)
    smtpPort: Optional[int] = Field(default=None, ge=1, le=65535)
    smtpUser: Optional[str] = Field(default=None, max_length=200)
    smtpPassword: Optional[str] = Field(default=None, max_length=400)
    emailFrom: Optional[str] = Field(default=None, max_length=200)
    emailTo: Optional[str] = Field(default=None, max_length=200)
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


@router.post("/settings/test-notification")
def test_notification():
    """Envoie un message de test à tous les canaux configurés (Discord/Telegram/e-mail)."""
    results = notify_all(
        "✅ Test de notification depuis Shopping Assistant — la configuration fonctionne.",
        subject="Shopping Assistant — test de notification",
    )
    if not any(results.values()):
        raise HTTPException(
            status_code=400,
            detail="Aucun canal configuré ou tous ont échoué (vérifie Discord / Telegram / e-mail).",
        )
    return {"sent": results}
