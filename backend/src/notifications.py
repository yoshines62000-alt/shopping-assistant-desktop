"""Notifications multi-canal (F16) : Discord + Telegram + e-mail SMTP.

`notify_all(message)` diffuse à tous les canaux configurés dans les réglages.
Chaque canal est silencieux s'il n'est pas configuré, et tolérant aux erreurs
(une panne d'un canal n'empêche pas les autres). Utilisé par la tâche de fond
pour les alertes prix et les bons plans du deal-watcher.
"""

import logging
import smtplib
from email.message import EmailMessage

import requests

from .settings_store import get_app_settings

logger = logging.getLogger("notifications")


def notify_discord(message: str) -> bool:
    webhook = get_app_settings().get("discordWebhookUrl", "")
    if not webhook:
        return False
    try:
        resp = requests.post(webhook, json={"content": message}, timeout=10)
        resp.raise_for_status()
        return True
    except Exception as exc:
        logger.error("Notification Discord échouée : %s", exc)
        return False


def notify_telegram(message: str) -> bool:
    s = get_app_settings()
    token = s.get("telegramBotToken", "")
    chat_id = s.get("telegramChatId", "")
    if not (token and chat_id):
        return False
    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": message, "disable_web_page_preview": False},
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except Exception as exc:
        logger.error("Notification Telegram échouée : %s", exc)
        return False


def notify_email(subject: str, message: str) -> bool:
    s = get_app_settings()
    host = s.get("smtpHost", "")
    to_addr = s.get("emailTo", "")
    if not (host and to_addr):
        return False
    from_addr = s.get("emailFrom") or s.get("smtpUser") or to_addr
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to_addr
        msg.set_content(message)
        port = int(s.get("smtpPort", 587) or 587)
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.ehlo()
            try:
                server.starttls()
                server.ehlo()
            except smtplib.SMTPException:
                pass  # serveur sans TLS (rare) : on continue en clair
            user, pwd = s.get("smtpUser", ""), s.get("smtpPassword", "")
            if user and pwd:
                server.login(user, pwd)
            server.send_message(msg)
        return True
    except Exception as exc:
        logger.error("Notification e-mail échouée : %s", exc)
        return False


def notify_all(message: str, subject: str = "Shopping Assistant") -> dict[str, bool]:
    """Diffuse à tous les canaux configurés. Retourne le statut par canal."""
    return {
        "discord": notify_discord(message),
        "telegram": notify_telegram(message),
        "email": notify_email(subject, message),
    }
