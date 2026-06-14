"""Detecteur d'arbitrage inter-plateformes.

Pour une requete, interroge TOUTES les sources, regroupe les offres du meme
produit (titre normalise + similarite), puis pour chaque groupe couvrant >=2
plateformes calcule le spread net : acheter sur la source la moins chere et
revendre sur la plus chere, frais de revente deduits. Trie par marge.

Le matching est heuristique : on renvoie toujours les deux annonces pour que
l'utilisateur juge avant d'acheter.
"""

import logging
import re
import unicodedata
from typing import Any

from fastapi import APIRouter

from ..config import get_settings
from ..settings_store import get_app_settings
from .search import SearchPayload, search_products

logger = logging.getLogger("routes.arbitrage")
router = APIRouter()

# Mots vides : marque/modele comptent, pas l'etat ni les couleurs.
_STOPWORDS = {
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "en", "au", "aux",
    "pour", "avec", "sans", "sur", "par", "the", "a", "an", "of", "for", "with",
    "neuf", "neuve", "occasion", "etat", "tres", "bon", "bonne", "comme", "taille",
    "couleur", "noir", "noire", "blanc", "blanche", "gris", "grise", "bleu", "rouge",
    "vert", "rose", "new", "used", "size", "color", "black", "white", "edition",
    "lot", "pcs", "set", "version", "modele", "model", "garantie", "livraison",
}


def _normalize_title(title: str) -> list[str]:
    """Tokens significatifs d'un titre (minuscules, sans accents/ponctuation, sans mots vides)."""
    t = unicodedata.normalize("NFKD", (title or "").lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return [w for w in t.split() if len(w) >= 2 and w not in _STOPWORDS]


def _similar(a: list[str], b: list[str]) -> bool:
    """Vrai si deux titres designent probablement le meme produit."""
    sa, sb = set(a), set(b)
    if not sa or not sb:
        return False
    inter = sa & sb
    jaccard = len(inter) / len(sa | sb)
    # Token fort = contient un chiffre (modele) ou mot >= 4 lettres (marque/produit).
    strong = any(any(ch.isdigit() for ch in w) or len(w) >= 4 for w in inter)
    return jaccard >= 0.45 and strong


def _cluster(products: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Regroupe les offres par produit (greedy sur la similarite de titre)."""
    clusters: list[dict[str, Any]] = []
    for p in products:
        tokens = _normalize_title(p.get("name", ""))
        if not tokens:
            continue
        for c in clusters:
            if _similar(tokens, c["tokens"]):
                c["items"].append(p)
                break
        else:
            clusters.append({"tokens": tokens, "items": [p]})
    return [c["items"] for c in clusters]


def _platform_fee(site_domain: str, fees: dict[str, Any], default_rate: float) -> float:
    d = (site_domain or "").lower()
    if "ebay" in d:
        return float(fees.get("ebay", default_rate))
    if "vinted" in d:
        return float(fees.get("vinted", default_rate))
    if "leboncoin" in d:
        return float(fees.get("leboncoin", default_rate))
    return default_rate


def _slim(item: dict[str, Any]) -> dict[str, Any]:
    return {k: item.get(k) for k in ("id", "name", "totalPrice", "siteDomain", "sourceUrl", "rating", "reviewCount")}


def find_arbitrage(products: list[dict[str, Any]], min_margin_pct: float) -> list[dict[str, Any]]:
    """Paires achat->revente inter-plateformes rentables, triees par marge."""
    settings = get_settings()
    fees = get_app_settings().get("platformFees", {})
    default_rate = settings.resale_fee_rate

    pairs: list[dict[str, Any]] = []
    for items in _cluster(products):
        items = [i for i in items if float(i.get("totalPrice") or 0) > 0 and i.get("siteDomain")]
        if len({i["siteDomain"] for i in items}) < 2:
            continue
        buy = min(items, key=lambda i: float(i["totalPrice"]))
        candidates = [i for i in items if i["siteDomain"] != buy["siteDomain"]]
        if not candidates:
            continue
        sell = max(candidates, key=lambda i: float(i["totalPrice"]))

        buy_price = float(buy["totalPrice"])
        sell_price = float(sell["totalPrice"])
        fee = _platform_fee(sell["siteDomain"], fees, default_rate)
        margin = sell_price * (1 - fee) - buy_price
        margin_pct = (margin / buy_price * 100) if buy_price > 0 else 0.0
        if margin <= 0 or margin_pct < min_margin_pct:
            continue
        pairs.append({
            "name": buy.get("name", ""),
            "buy": _slim(buy),
            "sell": _slim(sell),
            "marginEur": round(margin, 2),
            "marginPct": round(margin_pct, 1),
            "feeRate": fee,
        })

    pairs.sort(key=lambda p: p["marginEur"], reverse=True)
    return pairs


@router.post("/arbitrage")
async def arbitrage_scan(payload: dict[str, Any]) -> dict[str, Any]:
    query = str(payload.get("query") or "").strip()
    if not query:
        return {"query": query, "minMarginPct": 0, "pairs": [], "sources_queried": []}

    try:
        min_margin = float(payload.get("minMarginPct") or 15)
    except (TypeError, ValueError):
        min_margin = 15.0

    # Toutes les sources (on ignore tout filtre site pour comparer entre plateformes).
    search_payload = SearchPayload(**{**payload, "site": None, "connector": None, "maxResults": 30, "offset": 0})
    res = await search_products(search_payload)
    pairs = find_arbitrage(res.get("results", []), min_margin)
    return {
        "query": query,
        "minMarginPct": min_margin,
        "pairs": pairs,
        "sources_queried": res.get("sources_queried", []),
    }
