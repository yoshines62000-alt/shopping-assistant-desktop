from src.routes.arbitrage import _cluster, _normalize_title, _similar, find_arbitrage


def _p(pid, name, price, site):
    return {"id": pid, "name": name, "totalPrice": price, "siteDomain": site, "sourceUrl": f"http://{site}/{pid}"}


def test_normalize_title_drops_stopwords_and_accents():
    toks = _normalize_title("Casque Bluetooth NEUF Noir - Édition 2024")
    assert "casque" in toks and "bluetooth" in toks
    assert "neuf" not in toks and "noir" not in toks  # mots vides
    assert "edition" not in toks  # stopword + sans accent
    assert "2024" in toks


def test_similar_same_product():
    a = _normalize_title("Apple AirPods Pro 2 USB-C")
    b = _normalize_title("AirPods Pro 2 (USB C) Apple")
    assert _similar(a, b)


def test_similar_different_product():
    a = _normalize_title("Apple AirPods Pro 2")
    b = _normalize_title("Sony WH-1000XM5 casque")
    assert not _similar(a, b)


def test_cluster_groups_same_product():
    products = [
        _p("1", "Apple AirPods Pro 2 USB-C", 180, "vinted.fr"),
        _p("2", "AirPods Pro 2 USB C Apple", 230, "ebay.fr"),
        _p("3", "Sony WH-1000XM5", 250, "amazon.fr"),
    ]
    sizes = sorted(len(c) for c in _cluster(products))
    assert sizes == [1, 2]


def test_find_arbitrage_detects_spread():
    products = [
        _p("1", "Apple AirPods Pro 2 USB-C", 50.0, "vinted.fr"),
        _p("2", "AirPods Pro 2 USB C Apple", 300.0, "ebay.fr"),
    ]
    pairs = find_arbitrage(products, min_margin_pct=15)
    assert len(pairs) == 1
    pair = pairs[0]
    assert pair["buy"]["siteDomain"] == "vinted.fr"   # le moins cher
    assert pair["sell"]["siteDomain"] == "ebay.fr"     # le plus cher, autre plateforme
    assert pair["marginEur"] > 0
    assert pair["marginPct"] >= 15


def test_find_arbitrage_skips_single_source():
    products = [
        _p("1", "Apple AirPods Pro 2 USB-C", 50.0, "vinted.fr"),
        _p("2", "AirPods Pro 2 USB C Apple", 300.0, "vinted.fr"),
    ]
    assert find_arbitrage(products, min_margin_pct=15) == []
