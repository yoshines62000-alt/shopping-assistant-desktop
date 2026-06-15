"""Tests de la detection anti-bot (connectors/blockcheck)."""

import pytest

from src.connectors.blockcheck import detect_block


@pytest.mark.parametrize(
    "html, attendu",
    [
        ("<p>Type the characters you see in this image</p>", "captcha Amazon"),
        ("Pour toute question : api-services-support@amazon.com", "robot check Amazon"),
        ("<title>Attention Required! | Cloudflare</title>", "Cloudflare"),
        ("Checking your browser before accessing the site", "Cloudflare"),
        ('<script src="https://captcha-delivery.com/c.js">', "DataDome"),
        ("<h1>Pardon Our Interruption...</h1>", "Imperva"),
        ("Access to this page has been denied.", "PerimeterX"),
        ("You don't have permission to access this resource", "Access Denied"),
    ],
)
def test_detecte_les_blocages(html, attendu):
    assert detect_block(html) == attendu


def test_page_de_resultats_normale_non_signalee():
    # Extrait representatif d'une vraie page Amazon : aucun faux positif.
    html = (
        '<div data-component-type="s-search-result" data-asin="B0CXYZ1234">'
        '<h2><a><span>Casque Bluetooth Sony</span></a></h2>'
        '<span class="a-price"><span class="a-offscreen">49,99 €</span></span>'
        '</div>'
    )
    assert detect_block(html) is None


def test_entrees_vides():
    assert detect_block("") is None
    assert detect_block(None) is None


def test_insensible_a_la_casse():
    assert detect_block("UNUSUAL TRAFFIC from your network") == "trafic inhabituel"
