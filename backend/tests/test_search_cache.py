from src.routes.search import ScoringWeights, _cache_fingerprint


def test_search_cache_fingerprint_includes_filters_but_not_pagination():
    base = _cache_fingerprint(
        "lego",
        "",
        None,
        None,
        None,
        None,
        [],
        ScoringWeights(),
    )
    max_price = _cache_fingerprint(
        "lego",
        "",
        None,
        50.0,
        None,
        None,
        [],
        ScoringWeights(),
    )
    min_rating = _cache_fingerprint(
        "lego",
        "",
        None,
        None,
        None,
        4.0,
        [],
        ScoringWeights(),
    )
    site = _cache_fingerprint(
        "lego",
        "ebay",
        None,
        None,
        None,
        None,
        [],
        ScoringWeights(),
    )
    page_two = _cache_fingerprint(
        "lego",
        "",
        None,
        None,
        None,
        None,
        [],
        ScoringWeights(),
    )

    assert len({base, max_price, min_rating, site}) == 4
    assert base == page_two
