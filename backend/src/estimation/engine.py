import datetime
import logging
import re
import statistics
from typing import Any, Optional
from urllib.parse import quote_plus

from ..barcode import is_barcode, resolve_barcode
from ..config import get_settings
from ..connectors.browser import fetch_page_html
from ..connectors.ebay import parse_search_page
from ..normalization.engine import NormalizationEngine

logger = logging.getLogger("estimation")

_normalizer = NormalizationEngine()

# Mois FR + EN (prefixe suffisant : "octobre"/"oct" -> 10, "déc"/"december" -> 12)
_MONTHS = {
    "janv": 1, "jan": 1, "févr": 2, "fevr": 2, "feb": 2, "mars": 3, "mar": 3,
    "avr": 4, "apr": 4, "mai": 5, "may": 5, "juin": 6, "jun": 6, "juil": 7, "jul": 7,
    "août": 8, "aout": 8, "aug": 8, "sept": 9, "sep": 9, "oct": 10, "nov": 11,
    "déc": 12, "dec": 12,
}


def _month_num(token: str) -> Optional[int]:
    token = token.strip(". ").lower()
    if token in _MONTHS:
        return _MONTHS[token]
    for key, value in _MONTHS.items():
        if token.startswith(key):
            return value
    return None


def _parse_sold_date(text: str) -> Optional[datetime.date]:
    """Date d'une vente conclue eBay : "Vendu le 12 oct. 2024", "Sold 12 Oct 2024",
    "Sold Oct 12, 2024". Retourne None si non reconnue."""
    if not text:
        return None
    t = text.lower().replace(".", " ")
    # JJ mois AAAA (FR + EN "12 oct 2024")
    m = re.search(r"(\d{1,2})\s+([a-zàâäéèêëîïôöùûüç]{3,})\s+(\d{4})", t)
    if m:
        mon = _month_num(m.group(2))
        if mon:
            try:
                return datetime.date(int(m.group(3)), mon, int(m.group(1)))
            except ValueError:
                return None
    # mois JJ AAAA (EN "oct 12 2024")
    m = re.search(r"([a-zàâäéèêëîïôöùûüç]{3,})\s+(\d{1,2})\s+(\d{4})", t)
    if m:
        mon = _month_num(m.group(1))
        if mon:
            try:
                return datetime.date(int(m.group(3)), mon, int(m.group(2)))
            except ValueError:
                return None
    return None


def _compute_velocity(dates: list[datetime.date]) -> dict[str, Any]:
    """Vitesse de revente a partir des dates de ventes conclues. Vide si < 2 dates."""
    dates = sorted(d for d in dates if d)
    if len(dates) < 2:
        return {}
    span_days = max((dates[-1] - dates[0]).days, 1)
    count = len(dates)
    sales_per_30d = round(count / span_days * 30, 1)
    avg_between = round(span_days / (count - 1), 1)
    if sales_per_30d >= 20:
        label = "rapide"
    elif sales_per_30d >= 5:
        label = "moyen"
    else:
        label = "lent"
    return {
        "salesPer30d": sales_per_30d,
        "avgDaysBetweenSales": avg_between,
        "velocityLabel": label,
    }


def summarize_prices(
    prices: list[float],
    purchase_price: Optional[float] = None,
    fee_rate: float = 0.13,
) -> Optional[dict[str, Any]]:
    """Statistiques de revente à partir de prix de ventes réussies.

    Fonction pure (testable sans réseau). Écarte les valeurs aberrantes par
    filtre IQR (accessoires à 5 € ou lots à 500 € qui polluent la recherche),
    puis calcule médiane, fourchette P25-P75 et net vendeur après frais.
    """
    prices = sorted(p for p in prices if p > 0)
    if not prices:
        return None

    if len(prices) >= 8:
        q1, _, q3 = statistics.quantiles(prices, n=4)
        iqr = q3 - q1
        lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        filtered = [p for p in prices if lo <= p <= hi]
        if filtered:
            prices = filtered

    median = statistics.median(prices)
    if len(prices) >= 2:
        q1, _, q3 = statistics.quantiles(prices, n=4)
    else:
        q1 = q3 = median

    net = median * (1 - fee_rate)
    summary: dict[str, Any] = {
        "sampleCount": len(prices),
        "median": round(median, 2),
        "low": round(q1, 2),
        "high": round(q3, 2),
        "feeRate": fee_rate,
        "netEstimate": round(net, 2),
    }
    # Confiance : taille d'echantillon + dispersion (coefficient de variation).
    # Beaucoup de ventes a prix resserres => fiable ; peu de ventes ou prix
    # tres disperses => prudence.
    stdev = statistics.pstdev(prices) if len(prices) >= 2 else 0.0
    cv = (stdev / median) if median > 0 else 1.0
    sample_factor = min(len(prices), 20) / 20.0
    spread_factor = max(0.0, 1.0 - min(cv, 1.0))
    confidence_score = round(sample_factor * 60 + spread_factor * 40)
    summary["confidenceScore"] = confidence_score
    summary["confidenceLabel"] = (
        "élevée" if confidence_score >= 70 else "moyenne" if confidence_score >= 40 else "faible"
    )
    if purchase_price is not None and purchase_price > 0:
        profit = net - purchase_price
        summary["purchasePrice"] = round(purchase_price, 2)
        summary["estimatedProfit"] = round(profit, 2)
        summary["marginPct"] = round(profit / purchase_price * 100, 1)
    return summary


def estimate_resale(
    query: str,
    purchase_price: Optional[float] = None,
    platform: str = "ebay",
    max_samples: int = 25,
) -> dict[str, Any]:
    """Estime le prix de revente d'un objet à partir des ventes réussies eBay.

    Source : annonces VENDUES (LH_Sold=1&LH_Complete=1), donc des prix
    auxquels des acheteurs ont réellement payé — pas des prix affichés.
    Les frais appliqués au net vendeur dépendent de la plateforme de revente
    visée (réglages : eBay ~13 %, Vinted 0 %...).
    """
    from ..settings_store import get_app_settings

    settings = get_settings()
    fees = get_app_settings()["platformFees"]
    fee_rate = float(fees.get(platform, settings.resale_fee_rate))

    # Si la requête est un code-barres (scan en brocante), le traduire en nom de
    # produit : chercher le numéro EAN brut sur eBay ne renverrait rien.
    barcode: Optional[str] = None
    search_term = query
    if is_barcode(query):
        resolved = resolve_barcode(query)
        if resolved:
            barcode = query
            search_term = resolved

    url = (
        "https://www.ebay.fr/sch/i.html"
        f"?_nkw={quote_plus(search_term)}&LH_Sold=1&LH_Complete=1&_ipg=60"
    )
    try:
        html = fetch_page_html(
            url,
            wait_selector="li.s-card, li.s-item",
            warmup_url="https://www.ebay.fr/",
            profile="ebay",
        )
        raws = parse_search_page(html, max_samples)
    except Exception as exc:
        logger.error("Sold listings fetch failed: %s", exc)
        raws = []

    listings = []
    prices = []
    sold_dates: list[datetime.date] = []
    for raw in raws:
        price = _normalizer._parse_price(raw.price_raw)
        if price <= 0:
            continue
        prices.append(price)
        listings.append({
            "title": raw.title,
            "price": price,
            "url": raw.url,
            "imageUrl": (raw.extra or {}).get("image_url"),
        })
        sold = _parse_sold_date((raw.extra or {}).get("sold_date_raw", "")) if raw.extra else None
        if sold:
            sold_dates.append(sold)

    summary = summarize_prices(prices, purchase_price, fee_rate)
    result: dict[str, Any] = {
        "query": search_term,
        "source": "ebay.fr (ventes réussies)",
        "platform": platform,
        "soldListings": listings,
    }
    if barcode:
        result["barcode"] = barcode
    if summary is None:
        result["sampleCount"] = 0
        return result
    result.update(summary)
    result.update(_compute_velocity(sold_dates))  # vitesse de revente (si dates dispo)
    return result
