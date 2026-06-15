"""Capture des fixtures HTML reelles pour les tests de parsing.

Lance un vrai scrape Amazon + eBay et sauvegarde le HTML rendu dans
tests/fixtures/. Les tests (tests/test_fixtures_parsing.py) rejouent les parsers
sur ces pages reelles -> ils cassent si un site change son markup (selector rot)
ou si un parser regresse.

A relancer quand un site evolue :
    python -m src.scripts.capture_fixtures
puis verifier que les tests passent (sinon, ajuster les selecteurs).
"""

import gzip
from pathlib import Path
from urllib.parse import quote_plus

from ..connectors.amazon import parse_search_page as parse_amazon
from ..connectors.blockcheck import detect_block
from ..connectors.browser import fetch_page_html
from ..connectors.ebay import parse_search_page as parse_ebay

FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures"
QUERY = "casque bluetooth"


def _capture(name: str, html: str, parser) -> None:
    reason = detect_block(html)
    count = len(parser(html, 30))
    if reason:
        print(f"  {name}: BLOQUE ({reason}) -> non sauvegarde")
        return
    if count < 5:
        print(f"  {name}: seulement {count} produits extraits -> capture douteuse, non sauvegardee")
        return
    # Gzip : une page reelle pese ~2 Mo, compressee ~300 Ko -> repo plus leger.
    with gzip.open(FIXTURES / f"{name}.gz", "wb", compresslevel=9) as f:
        f.write(html.encode("utf-8"))
    print(f"  {name}.gz: OK ({count} produits, {len(html) // 1024} Ko -> compresse)")


def main() -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    print("Capture des fixtures (scrape reel)...")

    amazon = fetch_page_html(
        f"https://www.amazon.fr/s?k={quote_plus(QUERY)}&language=fr",
        wait_selector='div[data-component-type="s-search-result"]',
        profile="amazon",
    )
    _capture("amazon_search.html", amazon, parse_amazon)

    ebay = fetch_page_html(
        f"https://www.ebay.fr/sch/i.html?_nkw={quote_plus(QUERY)}&_ipg=60",
        wait_selector="li.s-card, li.s-item",
        warmup_url="https://www.ebay.fr/",
        profile="ebay",
    )
    _capture("ebay_search.html", ebay, parse_ebay)


if __name__ == "__main__":
    main()
