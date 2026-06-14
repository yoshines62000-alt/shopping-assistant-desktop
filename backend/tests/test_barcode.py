"""Tests de la résolution code-barres → nom de produit (sans réseau)."""

from unittest.mock import MagicMock, patch

from src.barcode import is_barcode, resolve_barcode


def test_is_barcode_accepts_ean_upc():
    assert is_barcode("3401579481234")  # EAN-13
    assert is_barcode("0123456789012")
    assert is_barcode("01234567")  # EAN-8
    assert is_barcode("  978020137962 ")  # espaces tolérés


def test_is_barcode_rejects_text_and_short_codes():
    assert not is_barcode("airpods pro 2")
    assert not is_barcode("12345")  # trop court
    assert not is_barcode("")
    assert not is_barcode("75192 lego")


def _resp(status: int, payload: dict) -> MagicMock:
    m = MagicMock()
    m.status_code = status
    m.json.return_value = payload
    return m


def test_resolve_uses_upcitemdb_first():
    with patch("src.barcode.requests.get") as get:
        get.return_value = _resp(200, {"items": [{"title": "Sony WH-1000XM4"}]})
        assert resolve_barcode("4548736112001") == "Sony WH-1000XM4"
        assert get.call_count == 1  # pas de repli si la première source répond


def test_resolve_falls_back_to_openfoodfacts():
    def side_effect(url, *args, **kwargs):
        if "upcitemdb" in url:
            return _resp(200, {"items": []})
        return _resp(200, {"status": 1, "product": {"product_name": "Nutella", "brands": "Ferrero"}})

    with patch("src.barcode.requests.get", side_effect=side_effect):
        assert resolve_barcode("3017620422003") == "Ferrero Nutella"


def test_resolve_returns_none_when_not_a_barcode():
    with patch("src.barcode.requests.get") as get:
        assert resolve_barcode("casque bluetooth") is None
        get.assert_not_called()


def test_resolve_returns_none_when_all_sources_fail():
    with patch("src.barcode.requests.get", side_effect=Exception("réseau coupé")):
        assert resolve_barcode("3401579481234") is None
