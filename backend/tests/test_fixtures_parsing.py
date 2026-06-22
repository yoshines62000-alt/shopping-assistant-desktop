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
from src.connectors.vinted import parse_catalog_json

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


def test_amazon_repli_structurel_si_conteneur_renomme():
    """Durcissement : si Amazon abandonne data-component-type='s-search-result',
    on rattrape les résultats via le repli structurel div.s-result-item[data-asin]."""
    html = """
    <div class="s-result-item" data-asin="B0ABCDEFGH">
      <h2><a><span>Casque Bluetooth Test</span></a></h2>
      <span class="a-price"><span class="a-offscreen">49,99 €</span></span>
      <span class="a-icon-alt">4,5 sur 5 étoiles</span>
      <img class="s-image" src="https://m.media-amazon.com/images/x.jpg"/>
    </div>
    """
    results = parse_amazon(html, 10)
    assert len(results) == 1
    assert results[0].title == "Casque Bluetooth Test"
    assert "/dp/B0ABCDEFGH" in results[0].url
    assert "49" in results[0].price_raw


def test_ebay_fixture_reelle():
    results = parse_ebay(_load("ebay_search.html"), 30)
    assert len(results) >= 10, "selecteurs eBay casses ? (page reelle -> trop peu d'annonces)"
    for p in results:
        assert p.title
        assert p.title.lower() != "shop on ebay"
        assert any(c.isdigit() for c in p.price_raw), f"prix invalide: {p.price_raw!r}"
        assert "/itm/" in p.url, f"URL annonce invalide: {p.url}"


def test_ebay_sold_fixture_reelle():
    # Page des ventes conclues (LH_Sold), utilisee par l'estimation de revente.
    results = parse_ebay(_load("ebay_sold.html"), 30)
    assert len(results) >= 10, "selecteurs eBay (ventes conclues) cassés ?"
    for p in results:
        assert p.title
        assert any(c.isdigit() for c in p.price_raw)
        assert "/itm/" in p.url
    # Les ventes conclues portent une date ("Vendu le...") -> calcul de vélocité.
    assert any(p.extra.get("sold_date_raw") for p in results), "dates de vente introuvables"


def test_vinted_fixture_reelle():
    results = parse_catalog_json(_load("vinted_catalog.json"), 30)
    assert len(results) >= 10, "format de l'API catalogue Vinted changé ?"
    for p in results:
        assert p.title
        assert any(c.isdigit() for c in p.price_raw), f"prix invalide: {p.price_raw!r}"
        assert p.url.startswith("http")
