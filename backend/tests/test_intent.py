from src.intent.ollama import _fallback_intent


def test_fallback_less_than_price():
    result = _fallback_intent("casque bluetooth moins de 30 euros")
    assert result["maxPriceEur"] == 30.0
    assert result["minPriceEur"] is None


def test_fallback_price_range():
    result = _fallback_intent("lego entre 20 et 50 €")
    assert result["minPriceEur"] == 20.0
    assert result["maxPriceEur"] == 50.0


def test_fallback_min_rating():
    result = _fallback_intent("montre connectée note minimum 4 étoiles")
    assert result["minRating"] == 4.0


def test_fallback_delivery_days():
    result = _fallback_intent("chargeur rapide livraison sous 3 jours")
    assert result["maxDeliveryDays"] == 3
    assert result["priority"] == "speed"


def test_fallback_quality_priority():
    result = _fallback_intent("appareil photo fiable et qualite premium")
    assert result["priority"] == "quality"
    assert result["weights"]["reviews"] == 0.35
    assert result["weights"]["site"] == 0.2
