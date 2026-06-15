import logging
import re

from bs4 import BeautifulSoup
from urllib.parse import quote_plus

from . import health
from .base import BaseConnector, ProductRaw
from .blockcheck import detect_block
from .browser import fetch_page_html

logger = logging.getLogger("connectors.ebay")

# URL canonique d'une annonce : on coupe tout tracking après l'identifiant numérique
ITEM_URL_RE = re.compile(r"https?://www\.ebay\.(?:fr|com)/itm/(?:[^/?#]+/)?(\d{9,})")

# Préfixe ajouté par eBay devant le titre des annonces récentes
NEW_LISTING_PREFIXES = ("nouvelle annonce", "new listing")


def parse_search_page(html: str, max_results: int) -> list[ProductRaw]:
    """Extrait les annonces réelles d'une page de résultats eBay.

    Supporte l'ancien markup (li.s-item) et le nouveau (li.s-card). Ne
    retourne que des items avec un titre, un prix affiché et une URL
    d'annonce /itm/{id} valide — jamais de valeur inventée.
    """
    soup = BeautifulSoup(html, "html.parser")
    results: list[ProductRaw] = []

    for item in soup.select("li.s-card, li.s-item, div.s-item"):
        link = item.select_one("a.s-item__link") or item.select_one("a[href*='/itm/']")
        title_el = item.select_one(".s-card__title, .s-item__title")
        price_el = item.select_one(".s-card__price, .s-item__price")
        if not (link and title_el and price_el):
            continue

        match = ITEM_URL_RE.match(link.get("href") or "")
        if not match:
            continue  # placeholder "Shop on eBay" ou lien de tracking
        item_id = match.group(1)
        url = f"https://www.ebay.fr/itm/{item_id}"

        # Retire le texte d'accessibilité masqué ("La page s'ouvre dans...")
        for hidden in title_el.select(".clipped, [aria-hidden='true']"):
            hidden.extract()
        title = title_el.get_text(" ", strip=True)
        title = title.replace("La page s'ouvre dans une nouvelle fenêtre", "").strip()
        for prefix in NEW_LISTING_PREFIXES:
            if title.lower().startswith(prefix):
                title = title[len(prefix):].strip()
        if not title or title.lower() == "shop on ebay":
            continue

        # Plage de prix ("12,34 EUR à 25,00 EUR") : on garde la borne basse
        price_text = price_el.get_text(" ", strip=True)
        price_text = re.split(r"\s(?:à|to)\s", price_text)[0].strip()
        if not any(ch.isdigit() for ch in price_text):
            continue

        delivery_raw = ""
        for row in item.select(".s-card__attribute-row, .s-item__shipping, .s-item__deliveryOptions"):
            row_text = row.get_text(" ", strip=True)
            if "livraison" in row_text.lower():
                delivery_raw = row_text
                break

        seller_el = item.select_one(".s-item__seller-info-text")
        reviews_el = item.select_one(".s-item__reviews-count span, .s-card__reviews-count")
        rating_el = item.select_one(".x-star-rating .clipped, .star-rating")

        # Date de vente (page des ventes conclues, LH_Sold=1) : "Vendu le 12 oct.
        # 2024" / "Sold 12 Oct 2024". Sert au calcul de velocite (cf. estimation).
        date_el = (
            item.select_one(".s-item__caption--signal")
            or item.select_one(".s-item__caption .POSITIVE")
            or item.select_one(".s-item__caption")
            or item.select_one(".s-card__caption")
        )
        sold_date_raw = date_el.get_text(" ", strip=True) if date_el else ""

        results.append(
            ProductRaw(
                title=title[:200],
                price_raw=price_text,
                delivery_raw=delivery_raw,
                seller=seller_el.get_text(" ", strip=True) if seller_el else "eBay",
                reviews_raw=reviews_el.get_text(" ", strip=True) if reviews_el else "",
                url=url,
                extra={
                    "item_id": item_id,
                    "rating_raw": rating_el.get_text(" ", strip=True) if rating_el else "",
                    "sponsored": bool(item.select_one(".s-item__adBadge, .s-card__badge-sponsored, [data-badge='sponsored']")),
                    "sold_date_raw": sold_date_raw,
                },
            )
        )
        if len(results) >= max_results:
            break

    return results


class EbayConnector(BaseConnector):
    site_key = "ebay"
    base_url = "https://www.ebay.fr"

    def search(self, query: str, max_results: int = 20) -> list[ProductRaw]:
        url = f"{self.base_url}/sch/i.html?_nkw={quote_plus(query)}&_ipg=60"
        try:
            # Warmup par la page d'accueil : eBay bloque les sessions qui
            # arrivent directement sur /sch/ (page d'erreur Akamai).
            # Le profil persistant garde les cookies → warmup une seule fois.
            html = fetch_page_html(
                url,
                wait_selector="li.s-card, li.s-item",
                warmup_url=f"{self.base_url}/",
                profile="ebay",
            )
        except Exception as exc:
            logger.error("eBay fetch failed: %s", exc)
            health.record(self.site_key, 0, issue="erreur reseau")
            return []

        results = parse_search_page(html, max_results)
        issue = None
        if not results:
            issue = detect_block(html)
            if issue:
                logger.warning("eBay: bloqué (%s) pour '%s'", issue, query)
            elif len(html) > 20000:
                logger.warning(
                    "eBay: page reçue (%d Ko) mais 0 annonce extraite — sélecteurs cassés ?",
                    len(html) // 1024,
                )
        health.record(self.site_key, len(results), issue)
        logger.info("eBay: %d real listings for '%s'", len(results), query)
        return results
