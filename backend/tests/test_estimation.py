import datetime

from src.estimation.engine import _compute_velocity, _parse_sold_date, summarize_prices


def test_empty_prices_returns_none():
    assert summarize_prices([]) is None
    assert summarize_prices([0, -5]) is None


def test_single_price():
    s = summarize_prices([100.0])
    assert s["median"] == 100.0
    assert s["low"] == 100.0
    assert s["high"] == 100.0
    assert s["sampleCount"] == 1


def test_median_and_range():
    s = summarize_prices([10.0, 20.0, 30.0, 40.0, 50.0])
    assert s["median"] == 30.0
    assert s["low"] < s["median"] < s["high"]


def test_net_estimate_applies_fee_rate():
    s = summarize_prices([100.0], fee_rate=0.13)
    assert s["netEstimate"] == 87.0
    assert s["feeRate"] == 0.13


def test_outliers_filtered_by_iqr():
    """Un accessoire à 5 € ne doit pas fausser l'estimation d'un objet à ~100 €."""
    prices = [5.0, 95.0, 98.0, 100.0, 102.0, 105.0, 99.0, 101.0, 97.0, 103.0]
    s = summarize_prices(prices)
    assert s["sampleCount"] == 9  # l'aberration à 5 € est écartée
    assert 95.0 <= s["median"] <= 105.0


def test_profit_and_margin_with_purchase_price():
    s = summarize_prices([100.0], purchase_price=50.0, fee_rate=0.13)
    assert s["purchasePrice"] == 50.0
    assert s["estimatedProfit"] == 37.0  # 87 net - 50 achat
    assert s["marginPct"] == 74.0


def test_negative_profit():
    s = summarize_prices([40.0], purchase_price=50.0, fee_rate=0.13)
    assert s["estimatedProfit"] < 0


# --- Velocite + confiance (Phase 1) ----------------------------------------

def test_parse_sold_date_fr():
    assert _parse_sold_date("Vendu le 12 oct. 2024") == datetime.date(2024, 10, 12)
    assert _parse_sold_date("12 octobre 2024") == datetime.date(2024, 10, 12)
    assert _parse_sold_date("Vendu le 3 déc. 2023") == datetime.date(2023, 12, 3)


def test_parse_sold_date_en():
    assert _parse_sold_date("Sold 5 Jan 2023") == datetime.date(2023, 1, 5)
    assert _parse_sold_date("Sold Oct 12 2024") == datetime.date(2024, 10, 12)


def test_parse_sold_date_invalid():
    assert _parse_sold_date("") is None
    assert _parse_sold_date("livraison gratuite") is None


def test_compute_velocity_needs_two_dates():
    assert _compute_velocity([]) == {}
    assert _compute_velocity([datetime.date(2024, 10, 1)]) == {}


def test_compute_velocity_rate_and_label():
    # 5 ventes sur 10 jours -> 15 ventes / 30 j -> "moyen"
    dates = [datetime.date(2024, 10, d) for d in (1, 3, 6, 9, 11)]
    vel = _compute_velocity(dates)
    assert vel["salesPer30d"] == 15.0
    assert vel["avgDaysBetweenSales"] == 2.5
    assert vel["velocityLabel"] == "moyen"


def test_compute_velocity_fast():
    base = datetime.date(2024, 10, 1)
    dates = [base + datetime.timedelta(days=i % 6) for i in range(10)]
    assert _compute_velocity(dates)["velocityLabel"] == "rapide"


def test_confidence_high_when_many_tight_prices():
    prices = [100.0 + (i % 3) for i in range(20)]
    s = summarize_prices(prices)
    assert s["confidenceLabel"] == "élevée"
    assert s["confidenceScore"] >= 70


def test_confidence_low_when_few_dispersed_prices():
    s = summarize_prices([10.0, 90.0])
    assert s["confidenceLabel"] == "faible"
