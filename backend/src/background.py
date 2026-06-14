"""Tâches de fond : vérification des alertes prix et ré-estimation du stock.

Lancées par le lifespan FastAPI dans une boucle asyncio. Chaque cycle :
1. re-scrape le prix actuel des produits sous alerte active, alimente
   price_history, notifie Discord et désactive l'alerte si le seuil est atteint ;
2. ré-estime quelques objets du stock dont l'estimation date de plus de
   `reestimateDays` jours (tendance ↗↘ via previous_estimate).
"""

import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone

import requests
from bs4 import BeautifulSoup
from sqlmodel import select

from .connectors.browser import fetch_page_html
from .db import get_session
from .estimation.engine import estimate_resale
from .models import Alert, PriceHistory, ProductRef, StockItem
from .normalization.engine import NormalizationEngine
from .settings_store import get_app_settings

logger = logging.getLogger("background")

_normalizer = NormalizationEngine()

# Objets ré-estimés au maximum par cycle (1 estimation ≈ 20 s de navigateur)
REESTIMATE_BATCH = 2


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def fetch_current_price(url: str) -> float | None:
    """Prix actuel d'une page produit Amazon (/dp/) ou eBay (/itm/)."""
    if not url.startswith("http"):
        return None
    try:
        if "amazon." in url:
            html = fetch_page_html(url, wait_selector=".a-price", profile="amazon")
            soup = BeautifulSoup(html, "html.parser")
            el = soup.select_one("#corePrice_feature_div .a-offscreen") or soup.select_one(
                ".a-price .a-offscreen"
            )
        elif "ebay." in url:
            html = fetch_page_html(
                url,
                wait_selector=".x-price-primary",
                warmup_url="https://www.ebay.fr/",
                profile="ebay",
            )
            soup = BeautifulSoup(html, "html.parser")
            el = soup.select_one(".x-price-primary .ux-textspans") or soup.select_one(
                ".x-price-primary"
            )
        else:
            return None
        if not el:
            return None
        price = _normalizer._parse_price(el.get_text(" ", strip=True))
        return price if price > 0 else None
    except Exception as exc:
        logger.warning("fetch_current_price failed for %s: %s", url, exc)
        return None


def notify_discord(message: str) -> bool:
    webhook = get_app_settings().get("discordWebhookUrl", "")
    if not webhook:
        logger.info("Discord non configuré, notification ignorée : %s", message)
        return False
    try:
        resp = requests.post(webhook, json={"content": message}, timeout=10)
        resp.raise_for_status()
        return True
    except Exception as exc:
        logger.error("Notification Discord échouée : %s", exc)
        return False


def _domain(url: str) -> str:
    m = re.search(r"https?://(?:www\.)?([^/]+)", url)
    return m.group(1) if m else "unknown"


def _resolve_url(product_id: str) -> str | None:
    """Retrouve l'URL marchande d'un produit : ID haché (ProductRef) ou URL directe."""
    if product_id.startswith("http"):
        return product_id
    with get_session() as session:
        ref = session.get(ProductRef, product_id)
        return ref.source_url if ref else None


def check_alerts() -> int:
    """Vérifie chaque alerte active. Retourne le nombre d'alertes déclenchées."""
    with get_session() as session:
        alerts = session.exec(select(Alert).where(Alert.active)).all()
    if not alerts:
        return 0

    triggered = 0
    for alert in alerts:
        url = _resolve_url(alert.product_id)
        if not url:
            logger.info("Alerte %s : URL introuvable pour %s", alert.id, alert.product_id)
            continue
        price = fetch_current_price(url)
        if price is None:
            continue
        with get_session() as session:
            session.add(
                PriceHistory(product_id=alert.product_id, price=price, connector=_domain(url))
            )
            if price <= alert.threshold_price:
                db_alert = session.get(Alert, alert.id)
                if db_alert:
                    db_alert.active = False
                    db_alert.triggered_at = _utcnow_naive()
                    session.add(db_alert)
                triggered += 1
                # Notification directe (Discord) : pas de worker requis.
                ref = session.get(ProductRef, alert.product_id)
                label = ref.name if ref and ref.name else alert.product_id
                notify_discord(
                    f"🔔 Alerte prix atteinte : {label}\n"
                    f"Prix actuel {price:.2f} € (seuil {alert.threshold_price:.2f} €)\n{url}"
                )
            session.commit()
    logger.info("Alertes vérifiées : %d, déclenchées : %d", len(alerts), triggered)
    return triggered


def reestimate_stale_stock() -> int:
    """Ré-estime les objets en stock dont l'estimation est ancienne. Retourne le nombre traité."""
    days = int(get_app_settings().get("reestimateDays", 7))
    cutoff = _utcnow_naive() - timedelta(days=days)
    with get_session() as session:
        items = session.exec(
            select(StockItem).where(StockItem.remaining > 0)
        ).all()
    stale = [i for i in items if i.estimated_at is None or i.estimated_at < cutoff]

    done = 0
    for item in stale[:REESTIMATE_BATCH]:
        result = estimate_resale(item.name, item.purchase_price)
        median = result.get("median")
        with get_session() as session:
            db_item = session.get(StockItem, item.id)
            if not db_item:
                continue
            if median:
                db_item.previous_estimate = db_item.estimated_resale
                db_item.estimated_resale = median
            # estimated_at avance même sans résultat pour ne pas retenter en boucle
            db_item.estimated_at = _utcnow_naive()
            session.add(db_item)
            session.commit()
        done += 1
    if done:
        logger.info("Stock ré-estimé : %d objet(s)", done)
    return done


async def background_loop(stop_event: asyncio.Event) -> None:
    # Premier passage différé : laisse l'app démarrer (et les tests se terminer)
    try:
        await asyncio.wait_for(stop_event.wait(), timeout=90)
        return
    except TimeoutError:
        pass

    while not stop_event.is_set():
        try:
            await asyncio.to_thread(check_alerts)
        except Exception as exc:
            logger.error("check_alerts crashed: %s", exc)
        try:
            await asyncio.to_thread(reestimate_stale_stock)
        except Exception as exc:
            logger.error("reestimate_stale_stock crashed: %s", exc)

        minutes = int(get_app_settings().get("alertCheckMinutes", 60))
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=max(5, minutes) * 60)
        except TimeoutError:
            continue
