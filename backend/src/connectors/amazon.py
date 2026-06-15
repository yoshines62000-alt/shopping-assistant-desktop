import logging
import re
from urllib.parse import quote_plus

from bs4 import BeautifulSoup

from .base import BaseConnector, ProductRaw
from .blockcheck import detect_block
from .browser import fetch_page_html

logger = logging.getLogger("connectors.amazon")

BASE_URL = "https://www.amazon.fr"

ASIN_RE = re.compile(r"^[A-Z0-9]{10}$")


def parse_search_page(html: str, max_results: int) -> list[ProductRaw]:
    """Extrait les produits réels d'une page de résultats Amazon.

    Chaque résultat doit avoir un ASIN et un prix affiché ; l'URL retournée
    est la page produit canonique /dp/{ASIN} (sans tracking sponsorisé).
    Les annonces sponsorisées sont marquées pour pénalité de score.
    """
    soup = BeautifulSoup(html, "html.parser")
    results: list[ProductRaw] = []

    for item in soup.select('div[data-component-type="s-search-result"]'):
        asin = (item.get("data-asin") or "").strip()
        if not ASIN_RE.match(asin):
            continue

        title_el = item.select_one("h2 a span") or item.select_one("h2 span") or item.select_one("h2")
        title = title_el.get_text(" ", strip=True) if title_el else ""
        if not title:
            continue

        # Sponsored detection : Amazon affichage "Sponsorisé" ou badge prime
        is_sponsored = bool(item.select_one('[data-component-type="s-status-indicator"]') or
                          item.select_one('.puis-label-popover-hover') or
                          'sponsor' in item.get('class', []))

        # Prix : .a-offscreen contient le prix complet ("1 234,56 €")
        price_el = item.select_one(".a-price > .a-offscreen") or item.select_one(".a-price .a-offscreen")
        if price_el:
            price_raw = price_el.get_text(strip=True)
        else:
            whole = item.select_one(".a-price-whole")
            frac = item.select_one(".a-price-fraction")
            if not whole:
                continue  # produit sans prix affiché : inutilisable
            price_raw = f"{whole.get_text(strip=True)},{frac.get_text(strip=True) if frac else '00'} €"
        if not any(ch.isdigit() for ch in price_raw):
            continue

        rating_el = item.select_one(".a-icon-alt")
        rating_raw = rating_el.get_text(strip=True) if rating_el else ""

        # Nombre d'avis : lien vers les reviews avec compteur souligné
        reviews_el = item.select_one("span.a-size-base.s-underline-text") or item.select_one(
            "a[href*='customerReviews'] span"
        )
        reviews_raw = reviews_el.get_text(strip=True) if reviews_el else ""

        delivery_el = item.select_one('[data-cy="delivery-recipe"]')
        delivery_raw = delivery_el.get_text(" ", strip=True) if delivery_el else ""

        results.append(
            ProductRaw(
                title=title[:200],
                price_raw=price_raw,
                delivery_raw=delivery_raw,
                seller="Amazon",
                reviews_raw=reviews_raw,
                url=f"{BASE_URL}/dp/{asin}",
                extra={"asin": asin, "rating_raw": rating_raw, "sponsored": is_sponsored},
            )
        )
        if len(results) >= max_results:
            break

    return results


class AmazonConnector(BaseConnector):
    site_key = "amazon"
    base_url = BASE_URL

    def search(self, query: str, max_results: int = 20) -> list[ProductRaw]:
        url = f"{self.base_url}/s?k={quote_plus(query)}&language=fr"
        try:
            html = fetch_page_html(
                url,
                wait_selector='div[data-component-type="s-search-result"]',
                profile="amazon",
            )
        except Exception as exc:
            logger.error("Amazon fetch failed: %s", exc)
            return []

        results = parse_search_page(html, max_results)
        if not results:
            reason = detect_block(html)
            if reason:
                logger.warning("Amazon: bloqué (%s) pour '%s'", reason, query)
            elif len(html) > 20000:
                logger.warning(
                    "Amazon: page reçue (%d Ko) mais 0 produit extrait — sélecteurs cassés ?",
                    len(html) // 1024,
                )
        logger.info("Amazon: %d real products for '%s'", len(results), query)
        return results
