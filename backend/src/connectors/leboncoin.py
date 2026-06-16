"""Connecteur Leboncoin.fr.

Leboncoin est une app Next.js : la page de résultats embarque les annonces dans
un script `__NEXT_DATA__` (JSON). On charge la page via le navigateur persistant
(comme eBay/Vinted) et on parse ce JSON — pas d'appel à l'API privée
(api.leboncoin.fr), protégée par DataDome et qui bannit les clients directs.

Si DataDome sert une page de challenge, `detect_block` la repère (signature
captcha-delivery.com) et le circuit breaker saute le connecteur après 3 échecs.
"""

import json
import logging
from urllib.parse import quote_plus

from bs4 import BeautifulSoup

from . import health
from .base import BaseConnector, ProductRaw
from .blockcheck import detect_block
from .browser import fetch_page_html

logger = logging.getLogger("connectors.leboncoin")

BASE_URL = "https://www.leboncoin.fr"


def _extract_next_data(html: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    tag = soup.find("script", id="__NEXT_DATA__")
    if not tag or not tag.string:
        return None
    try:
        return json.loads(tag.string)
    except (TypeError, json.JSONDecodeError):
        return None


def _find_ads(node: object) -> list | None:
    """Cherche en profondeur la liste d'annonces dans le JSON Next.

    Robuste aux changements d'imbrication : on retient la première liste de
    dicts ayant à la fois `subject` et `price` (la signature d'une annonce LBC).
    """
    if isinstance(node, dict):
        ads = node.get("ads")
        if isinstance(ads, list) and ads and isinstance(ads[0], dict) and "subject" in ads[0]:
            return ads
        for value in node.values():
            found = _find_ads(value)
            if found:
                return found
    elif isinstance(node, list):
        if node and isinstance(node[0], dict) and "subject" in node[0] and "price" in node[0]:
            return node
        for value in node:
            found = _find_ads(value)
            if found:
                return found
    return None


def _price_str(price: object) -> str:
    """Le prix LBC est usuellement une liste d'entiers en euros (`[120]`)."""
    amount: object = None
    if isinstance(price, list) and price:
        amount = price[0]
    elif isinstance(price, dict):
        amount = price.get("value") or price.get("amount")
    elif isinstance(price, (int, float)):
        amount = price
    if amount is None:
        return ""
    try:
        return f"{float(amount):.0f} €"
    except (TypeError, ValueError):
        return ""


def parse_search_page(html: str, max_results: int) -> list[ProductRaw]:
    data = _extract_next_data(html)
    if not data:
        return []
    ads = _find_ads(data) or []

    results: list[ProductRaw] = []
    for ad in ads[:max_results]:
        title = str(ad.get("subject") or "").strip()
        price_raw = _price_str(ad.get("price"))
        url = str(ad.get("url") or "")
        if url.startswith("/"):
            url = BASE_URL + url
        if not (title and price_raw and url.startswith("http")):
            continue

        location = ad.get("location") if isinstance(ad.get("location"), dict) else {}
        owner = ad.get("owner") if isinstance(ad.get("owner"), dict) else {}
        results.append(
            ProductRaw(
                title=title[:200],
                price_raw=price_raw,
                delivery_raw="",
                seller=str(owner.get("name") or "Leboncoin"),
                reviews_raw="",
                url=url,
                extra={
                    "list_id": ad.get("list_id"),
                    "city": location.get("city", ""),
                    "category": ad.get("category_name", ""),
                },
            )
        )
    return results


class LeboncoinConnector(BaseConnector):
    site_key = "leboncoin"
    base_url = BASE_URL

    def search(self, query: str, max_results: int = 20) -> list[ProductRaw]:
        url = f"{self.base_url}/recherche?text={quote_plus(query)}"
        try:
            html = fetch_page_html(
                url,
                wait_selector="script#__NEXT_DATA__",
                warmup_url=f"{self.base_url}/",
                profile="leboncoin",
            )
        except Exception as exc:
            logger.error("Leboncoin fetch failed: %s", exc)
            health.record(self.site_key, 0, issue="erreur reseau")
            return []

        results = parse_search_page(html, max_results)
        issue = None
        if not results:
            issue = detect_block(html)
            if issue:
                logger.warning("Leboncoin: bloqué (%s) pour '%s'", issue, query)
            elif len(html) > 20000:
                logger.warning(
                    "Leboncoin: page reçue (%d Ko) mais 0 annonce — structure changée ?",
                    len(html) // 1024,
                )
        health.record(self.site_key, len(results), issue)
        logger.info("Leboncoin: %d real listings for '%s'", len(results), query)
        return results
