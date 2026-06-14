"""Sponsored detection tests."""

from src.connectors.amazon import parse_search_page
from src.scoring.engine import ScoringEngine, ScoringWeights


def test_sponsored_detection_flag():
    """Verify sponsored items get flagged in extra."""
    html = '''
    <div data-component-type="s-search-result" data-asin="B012345678">
        <h2><a href="#"><span>Product 1</span></a></h2>
        <span class="a-price"><span class="a-offscreen">29,99 €</span></span>
    </div>
    <div data-component-type="s-search-result" data-asin="B087654321">
        <h2><a href="#"><span>Sponsored Product</span></a></h2>
        <span class="a-price"><span class="a-offscreen">39,99 €</span></span>
        <span class="puis-label-popover-hover">Sponsored</span>
    </div>
    '''
    results = parse_search_page(html, 10)
    assert len(results) == 2
    assert results[0].extra.get("sponsored") is False
    assert results[1].extra.get("sponsored") is True


def test_sponsored_penalty_in_scoring():
    """Verify sponsored items get 25% score penalty."""
    # Two identical products, one sponsored
    products = [
        {"total_price": 100, "delivery_days": 3, "rating": 4.5, "review_count": 100,
         "site_reputation": 50, "raw": {"sponsored": False}},
        {"total_price": 100, "delivery_days": 3, "rating": 4.5, "review_count": 100,
         "site_reputation": 50, "raw": {"sponsored": True}},
    ]
    engine = ScoringEngine()
    weights = ScoringWeights()
    scores = engine.score_many(products, weights)

    # Both should have similar base scores, but sponsored should be ~25% lower
    assert scores[0].final > scores[1].final
    assert abs(scores[0].final * 0.75 - scores[1].final) < 5  # Allow some tolerance


def test_sponsored_penalty_reads_extra_flag():
    """Régression : dans le pipeline réel, le flag sponsored vit dans raw['extra'].

    NormalizationEngine sérialise ProductRaw via __dict__, donc le drapeau se
    trouve sous raw['extra']['sponsored'], pas raw['sponsored'].
    """
    products = [
        {"total_price": 100, "delivery_days": 3, "rating": 4.5, "review_count": 100,
         "site_reputation": 50, "raw": {"extra": {"sponsored": False}}},
        {"total_price": 100, "delivery_days": 3, "rating": 4.5, "review_count": 100,
         "site_reputation": 50, "raw": {"extra": {"sponsored": True}}},
    ]
    scores = ScoringEngine().score_many(products, ScoringWeights())
    assert scores[0].final > scores[1].final
    assert abs(scores[0].final * 0.75 - scores[1].final) < 5


def test_ebay_sponsored_detection():
    """Verify eBay sponsored badge detection."""
    from src.connectors.ebay import parse_search_page as parse_ebay

    html = '''
    <li class="s-card">
        <a href="https://www.ebay.fr/itm/1234567890">Regular item</a>
        <div class="s-card__title">Regular Title</div>
        <div class="s-card__price">10,00 EUR</div>
    </li>
    <li class="s-card">
        <a href="https://www.ebay.fr/itm/0987654321">Sponsored item</a>
        <div class="s-card__title">Sponsored Title</div>
        <div class="s-card__price">20,00 EUR</div>
        <div class="s-card__badge-sponsored">Sponsored</div>
    </li>
    '''
    results = parse_ebay(html, 10)
    assert len(results) == 2, "Les deux items doivent être extraits"
    assert results[0].extra.get("sponsored") is False
    assert results[1].extra.get("sponsored") is True