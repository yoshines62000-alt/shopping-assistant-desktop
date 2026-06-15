"""Tests des parsers sur des fixtures HTML REELLES (pages Amazon/eBay capturees).

Complement des tests sur petits extraits : ici on rejoue le parser sur une vraie
page complete, ce qui detecte le "selector rot" (le site a change son markup) ou
une regression du parser. Re-capturer avec `python -m src.scripts.capture_fixtures`
quand un site evolue.
"""

import gzip
from pathlib import Path

import pytest

from src.connectors.amazon import parse_search_page as parse_amazon
from src.connectors.ebay import parse_search_page as parse_ebay

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _load(name: str) -> str:
    path = FIXTURES / f"{name}.gz"
    if not path.exists():
        pytest.skip(f"fixture absente: {name}.gz (lancer src.scripts.capture_fixtures)")
    with gzip.open(path, "rb") as f:
        return f.read().decode("utf-8")


def test_amazon_fixture_reelle():
    results = parse_amazon(_load("amazon_search.html"), 30)
    assert len(results) >= 10, "selecteurs Amazon casses ? (page reelle -> trop peu de produits)"
    for p in results:
        assert p.title, "titre manquant"
        assert any(c.isdigit() for c in p.price_raw), f"prix invalide: {p.price_raw!r}"
        assert "/dp/" in p.url, f"URL produit invalide: {p.url}"
    # Au moins un produit avec une note (champ optionnel mais usuel).
    assert any(p.extra.get("rating_raw") for p in results)


def test_ebay_fixture_reelle():
    results = parse_ebay(_load("ebay_search.html"), 30)
    assert len(results) >= 10, "selecteurs eBay casses ? (page reelle -> trop peu d'annonces)"
    for p in results:
        assert p.title
        assert p.title.lower() != "shop on ebay"
        assert any(c.isdigit() for c in p.price_raw), f"prix invalide: {p.price_raw!r}"
        assert "/itm/" in p.url, f"URL annonce invalide: {p.url}"
