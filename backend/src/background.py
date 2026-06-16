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

from bs4 import BeautifulSoup
from sqlmodel import select

from .connectors.browser import fetch_page_html
from .db import get_session
from .estimation.engine import estimate_resale
from .models import Alert, DealHit, PriceHistory, ProductRef, SavedSearch, StockItem
from .normalization.engine import NormalizationEngine
from .notifications import notify_all
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
    """Compat : diffuse désormais à TOUS les canaux configurés (Discord + Telegram
    + e-mail). Conservé sous ce nom pour les appels existants."""
    results = notify_all(message)
    if not any(results.values()):
        logger.info("Aucun canal de notification configuré : %s", message)
    return any(results.values())


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


# Deal-watcher : recherches favorites scannées par cycle (chaque scan lance les
# navigateurs des connecteurs ~10-20 s) et nombre de résultats demandés par scan.
SAVED_SEARCH_BATCH = 3
SAVED_SEARCH_RESULTS = 8


def _record_deal_hits(search: SavedSearch, results: list[dict], seed_only: bool = False) -> list[dict]:
    """Enregistre les offres <= seuil jamais vues pour cette recherche.

    Retourne la liste des NOUVELLES offres (pour notification). Si `seed_only`
    (F21, 1er scan), on enregistre la baseline sans rien retourner -> aucune
    notification pour les annonces déjà en ligne au moment de l'abonnement.
    """
    fresh: list[dict] = []
    with get_session() as session:
        existing = set(
            session.exec(
                select(DealHit.product_id).where(DealHit.saved_search_id == search.id)
            ).all()
        )
        for r in results:
            pid = r.get("id")
            price = float(r.get("totalPrice") or 0)
            if not pid or price <= 0 or price > search.target_price or pid in existing:
                continue
            existing.add(pid)
            session.add(
                DealHit(
                    saved_search_id=search.id,
                    product_id=pid,
                    name=(r.get("name") or "")[:300],
                    price=price,
                    source_url=r.get("sourceUrl", ""),
                    site_domain=r.get("siteDomain", ""),
                    notified=not seed_only,
                )
            )
            if not seed_only:
                fresh.append(r)
        # Avance last_checked même sans nouveauté pour faire tourner le batch.
        db_search = session.get(SavedSearch, search.id)
        if db_search:
            db_search.last_checked = _utcnow_naive()
            if seed_only:
                db_search.seeded = True
            session.add(db_search)
        session.commit()
    return fresh


async def scan_saved_searches() -> int:
    """Rejoue les recherches favorites actives, notifie les nouvelles bonnes
    affaires sous le seuil. Retourne le nombre de nouvelles offres trouvées."""
    with get_session() as session:
        searches = session.exec(select(SavedSearch).where(SavedSearch.active)).all()
    if not searches:
        return 0

    # F18 : ne garder que les recherches "dues" (intervalle min écoulé).
    now = _utcnow_naive()

    def _is_due(s: SavedSearch) -> bool:
        if not s.interval_minutes or s.last_checked is None:
            return True
        return (now - s.last_checked).total_seconds() >= s.interval_minutes * 60

    due = [s for s in searches if _is_due(s)]
    # Les moins récemment vérifiées d'abord (None = jamais -> prioritaire).
    due.sort(key=lambda s: s.last_checked or datetime.min)
    batch = due[:SAVED_SEARCH_BATCH]

    from .routes.search import SearchPayload, search_products

    total_new = 0
    for search in batch:
        try:
            res = await search_products(
                SearchPayload(
                    query=search.query,
                    maxResults=SAVED_SEARCH_RESULTS,
                    maxPriceEur=search.target_price,
                    site=search.site or None,
                )
            )
        except Exception as exc:
            logger.error("scan_saved_searches '%s' failed: %s", search.query, exc)
            continue
        fresh = await asyncio.to_thread(
            _record_deal_hits, search, res.get("results", []), not search.seeded
        )
        if fresh:
            total_new += len(fresh)
            lines = "\n".join(
                f"• {d.get('name', '')[:70]} — {float(d.get('totalPrice') or 0):.2f} € ({d.get('siteDomain', '')})\n  {d.get('sourceUrl', '')}"
                for d in fresh[:5]
            )
            notify_discord(
                f"🛍️ {len(fresh)} bon(s) plan(s) pour « {search.query} » "
                f"(≤ {search.target_price:.0f} €) :\n{lines}"
            )
    if total_new:
        logger.info("Deal-watcher : %d nouvelle(s) offre(s) trouvée(s)", total_new)
    return total_new


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
        try:
            await scan_saved_searches()
        except Exception as exc:
            logger.error("scan_saved_searches crashed: %s", exc)

        minutes = int(get_app_settings().get("alertCheckMinutes", 60))
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=max(5, minutes) * 60)
        except TimeoutError:
            continue
