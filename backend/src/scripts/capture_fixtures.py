"""Capture des fixtures reelles pour les tests de parsing.

Lance un vrai scrape (Amazon, eBay recherche, eBay ventes conclues, Vinted API)
et sauvegarde le contenu rendu dans tests/fixtures/. Les tests
(tests/test_fixtures_parsing.py) rejouent les parsers sur ces captures reelles
-> ils cassent si un site change son markup (selector rot) ou si un parser
regresse.

A relancer quand un site evolue :
    python -m src.scripts.capture_fixtures
puis verifier que les tests passent (sinon, ajuster les selecteurs).
"""

import gzip
from pathlib import Path
from urllib.parse import quote_plus

from ..connectors.amazon import parse_search_page as parse_amazon
from ..connectors.blockcheck import detect_block
from ..connectors.browser import fetch_json_via_page, fetch_page_html
from ..connectors.ebay import parse_search_page as parse_ebay
from ..connectors.vinted import parse_catalog_json

FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures"
QUERY = "casque bluetooth"


def _save(name: str, text: str) -> None:
    # Gzip : une page reelle pese ~2 Mo, compressee ~300 Ko -> repo plus leger.
    with gzip.open(FIXTURES / f"{name}.gz", "wb", compresslevel=9) as f:
        f.write(text.encode("utf-8"))


def _capture(name: str, html: str, parser) -> None:
    reason = detect_block(html)
    count = len(parser(html, 30))
    if reason:
        print(f"  {name}: BLOQUE ({reason}) -> non sauvegarde")
        return
    if count < 5:
        print(f"  {name}: seulement {count} resultats -> capture douteuse, non sauvegardee")
        return
    _save(name, html)
    print(f"  {name}.gz: OK ({count} resultats, {len(html) // 1024} Ko -> compresse)")


def _capture_json(name: str, body: str | None) -> None:
    if not body:
        print(f"  {name}: reponse vide / bloquee -> non sauvegarde")
        return
    count = len(parse_catalog_json(body, 30))
    if count < 5:
        print(f"  {name}: seulement {count} items -> capture douteuse, non sauvegardee")
        return
    _save(name, body)
    print(f"  {name}.gz: OK ({count} items, {len(body) // 1024} Ko -> compresse)")


def main() -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    print("Capture des fixtures (scrape reel)...")

    _capture(
        "amazon_search.html",
        fetch_page_html(
            f"https://www.amazon.fr/s?k={quote_plus(QUERY)}&language=fr",
            wait_selector='div[data-component-type="s-search-result"]',
            profile="amazon",
        ),
        parse_amazon,
    )

    _capture(
        "ebay_search.html",
        fetch_page_html(
            f"https://www.ebay.fr/sch/i.html?_nkw={quote_plus(QUERY)}&_ipg=60",
            wait_selector="li.s-card, li.s-item",
            warmup_url="https://www.ebay.fr/",
            profile="ebay",
        ),
        parse_ebay,
    )

    # eBay ventes conclues (LH_Sold) : utilise par l'estimation de revente.
    _capture(
        "ebay_sold.html",
        fetch_page_html(
            f"https://www.ebay.fr/sch/i.html?_nkw={quote_plus(QUERY)}&LH_Sold=1&LH_Complete=1&_ipg=60",
            wait_selector="li.s-card, li.s-item",
            warmup_url="https://www.ebay.fr/",
            profile="ebay",
        ),
        parse_ebay,
    )

    # Vinted : API catalogue JSON appelee depuis une vraie page.
    _capture_json(
        "vinted_catalog.json",
        fetch_json_via_page(
            f"/api/v2/catalog/items?search_text={quote_plus(QUERY)}&per_page=30",
            warmup_url="https://www.vinted.fr/",
            profile="vinted",
        ),
    )


if __name__ == "__main__":
    main()
