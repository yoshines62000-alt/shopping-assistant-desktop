"""Réglages applicatifs persistés en base (table AppSetting, JSON unique).

Fusionnés avec les valeurs par défaut : l'app fonctionne même sans Postgres
(les défauts s'appliquent) et les clés inconnues sont ignorées.
"""

import json
import logging
from typing import Any

from sqlmodel import Session

from .db import engine  # type: ignore[attr-defined]
from .models import AppSetting

logger = logging.getLogger("settings_store")

SETTINGS_KEY = "app"

DEFAULTS: dict[str, Any] = {
    # Frais plateforme appliqués au net vendeur des estimations
    "platformFees": {"ebay": 0.13, "vinted": 0.0, "leboncoin": 0.0, "autre": 0.10},
    # Webhook Discord pour les notifications d'alerte prix (vide = désactivé)
    "discordWebhookUrl": "",
    # Telegram : bot token + chat id (les deux requis, sinon désactivé)
    "telegramBotToken": "",
    "telegramChatId": "",
    # E-mail SMTP pour les notifications (emailTo + smtpHost requis)
    "smtpHost": "",
    "smtpPort": 587,
    "smtpUser": "",
    "smtpPassword": "",
    "emailFrom": "",
    "emailTo": "",
    # Intervalle de vérification des alertes prix (minutes)
    "alertCheckMinutes": 60,
    # Âge (jours) au-delà duquel un objet du stock est ré-estimé automatiquement
    "reestimateDays": 7,
    # F17 : digest hebdomadaire envoyé aux canaux de notification (+ horodatage interne)
    "weeklyDigestEnabled": False,
    "weeklyDigestLast": "",
}


def get_app_settings() -> dict[str, Any]:
    merged = json.loads(json.dumps(DEFAULTS))  # copie profonde
    try:
        with Session(engine) as session:
            row = session.get(AppSetting, SETTINGS_KEY)
            if row:
                stored = json.loads(row.value)
                for key, value in stored.items():
                    if key not in DEFAULTS:
                        continue
                    if isinstance(DEFAULTS[key], dict) and isinstance(value, dict):
                        merged[key].update(value)
                    else:
                        merged[key] = value
    except Exception as exc:
        logger.debug("Settings DB unavailable, using defaults: %s", exc)
    return merged


def update_app_settings(partial: dict[str, Any]) -> dict[str, Any]:
    current = get_app_settings()
    for key, value in partial.items():
        if key not in DEFAULTS or value is None:
            continue
        if isinstance(DEFAULTS[key], dict) and isinstance(value, dict):
            current[key].update({k: v for k, v in value.items() if v is not None})
        else:
            current[key] = value
    with Session(engine) as session:
        row = session.get(AppSetting, SETTINGS_KEY) or AppSetting(key=SETTINGS_KEY)
        row.value = json.dumps(current)
        session.add(row)
        session.commit()
    return current
