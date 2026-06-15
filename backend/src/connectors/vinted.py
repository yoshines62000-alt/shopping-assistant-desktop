import json
import logging
from urllib.parse import quote_plus

from . import health
from .base import BaseConnector, ProductRaw
from .browser import fetch_json_via_page

logger = logging.getLogger("connectors.vinted")


def parse_catalog_json(body: str, max_results: int) -> list[ProductRaw]:
    """Convertit la réponse de l'API catalogue Vinted en ProductRaw.

    Uniquement des annonces réelles : titre, prix affiché et URL /items/{id}.
    """
    try:
        data = json.loads(body)
    except (TypeError, json.JSONDecodeError):
        return []

    results: list[ProductRaw] = []
    for item in data.get("items", [])[:max_results]:
        url = str(item.get("url") or "")
        title = str(item.get("title") or "").strip()
        price = item.get("price") or {}
        amount = price.get("amount") if isinstance(price, dict) else price
        if not (url.startswith("http") and title and amount):
            continue

        user = item.get("user") or {}
        results.append(
            ProductRaw(
                title=title[:200],
                price_raw=f"{amount} €",
                delivery_raw="",
                seller=str(user.get("login") or "Vinted"),
                reviews_raw=str(user.get("positive_feedback_count") or ""),
                url=url,
                extra={
                    "vinted_id": item.get("id"),
                    "brand": item.get("brand_title", ""),
                    "size": item.get("size_title", ""),
                    "status": item.get("status", ""),
                },
            )
        )
    return results


class VintedConnector(BaseConnector):
    """Vinted.fr via son API catalogue, appelée depuis un vrai contexte de page
    (les clients HTTP directs sont bloqués par Datadome)."""

    site_key = "vinted"
    base_url = "https://www.vinted.fr"

    def search(self, query: str, max_results: int = 20) -> list[ProductRaw]:
        api_url = f"/api/v2/catalog/items?search_text={quote_plus(query)}&per_page={max_results}"
        body = fetch_json_via_page(api_url, warmup_url=f"{self.base_url}/", profile="vinted")
        if body is None:
            logger.warning("Vinted API inaccessible")
            health.record(self.site_key, 0, issue="API inaccessible")
            return []
        results = parse_catalog_json(body, max_results)
        health.record(self.site_key, len(results))
        logger.info("Vinted: %d real listings for '%s'", len(results), query)
        return results
