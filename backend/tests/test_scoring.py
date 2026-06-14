from src.scoring.engine import ScoringEngine, ScoringWeights


def _product(price: float, delivery: int | None = None, rating: float | None = None, reviews: int | None = None):
    return {
        "total_price": price,
        "delivery_days": delivery,
        "rating": rating,
        "review_count": reviews,
    }


def test_cheaper_product_scores_higher():
    """Régression : le scoring prix était inversé (le moins cher scorait 0)."""
    engine = ScoringEngine()
    scores = engine.score_many([_product(10.0), _product(100.0)])
    assert scores[0].price == 100.0
    assert scores[1].price == 0.0
    assert scores[0].final > scores[1].final


def test_faster_delivery_scores_higher():
    engine = ScoringEngine()
    scores = engine.score_many([_product(50.0, delivery=1), _product(50.0, delivery=10)])
    assert scores[0].delivery > scores[1].delivery


def test_better_rating_scores_higher():
    engine = ScoringEngine()
    scores = engine.score_many([_product(50.0, rating=4.8), _product(50.0, rating=3.0)])
    assert scores[0].reviews > scores[1].reviews


def test_missing_values_get_neutral_score():
    engine = ScoringEngine()
    scores = engine.score_many([_product(50.0), _product(60.0)])
    assert scores[0].delivery == 50.0
    assert scores[0].reviews == 50.0


def test_custom_weights_are_normalized():
    weights = ScoringWeights(price=2.0, delivery=1.0, reviews=1.0, site=0.5, popularity=0.5)
    normalized = weights.normalized()
    assert abs(sum(normalized.values()) - 1.0) < 1e-9


def test_zero_site_reputation_stays_zero():
    engine = ScoringEngine()
    scores = engine.score_many([
        {"total_price": 50.0, "site_reputation": 0.0},
        {"total_price": 60.0, "site_reputation": 0.0},
    ])
    assert scores[0].site == 0.0
    assert scores[1].site == 0.0


def test_empty_input():
    assert ScoringEngine().score_many([]) == []
