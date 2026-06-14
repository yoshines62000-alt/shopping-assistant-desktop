"""Integration tests for worker-scraping communication."""

from unittest.mock import patch

import asyncio

import src.connectors.browser as browser_module
from src.connectors.base import ProductRaw
from src.connectors.browser import _next_proxy, _next_user_agent, USER_AGENTS
from src.config import Settings
from src.routes.digest import get_daily_digest
from src.routes.search import SearchPayload, search_products
from src.routes.watch import check_watch_prices


def test_search_api_accepts_filters():
    """Test that search endpoint accepts and applies filters - async."""
    payload = {
        'query': 'iphone',
        'maxPriceEur': 500,
        'minPriceEur': 100,
        'maxDeliveryDays': 3,
        'minRating': 4.0,
    }

    async def run():
        with patch('src.routes.search.CONNECTORS', []):
            result = await search_products(SearchPayload(**payload))
            assert 'results' in result
            return result

    asyncio.run(run())


def test_search_pagination_offset():
    """Test that search endpoint supports pagination via offset."""
    async def run():
        with patch('src.routes.search.CONNECTORS', []):
            result = await search_products(SearchPayload(query='test', offset=10, maxResults=5))
            assert result['query'] == 'test'
            return result

    asyncio.run(run())


class _FakeConnector:
    """Connecteur de test : renvoie des ProductRaw fixes (aucun réseau)."""

    def __init__(self, site_key, items):
        self.site_key = site_key
        self._items = items

    def search(self, query, max_results=20):
        return self._items[:max_results]


def _make_connector_cls(site_key, items):
    raws = [
        ProductRaw(
            title=title,
            price_raw=price,
            delivery_raw="",
            seller=site_key,
            reviews_raw="",
            url=url,
            extra={"site": f"{site_key}.fr"},
        )
        for title, price, url in items
    ]

    def factory():
        return _FakeConnector(site_key, raws)

    factory.__name__ = f"{site_key}Fake"
    factory.site_key = site_key
    return factory


def test_search_excludes_keywords():
    """Régression : excludeKeywords doit retirer les produits correspondants."""
    cls = _make_connector_cls("amazon", [
        ("Casque Bluetooth Sony", "50,00 €", "https://www.amazon.fr/dp/B000000001"),
        ("Casque Bluetooth Samsung", "40,00 €", "https://www.amazon.fr/dp/B000000002"),
    ])

    async def run():
        with patch('src.routes.search.CONNECTORS', [cls]):
            result = await search_products(SearchPayload(
                query='casque bluetooth',
                excludeKeywords=['samsung'],
                maxResults=10,
            ))
            names = [r['name'] for r in result['results']]
            assert any('Sony' in n for n in names)
            assert all('Samsung' not in n for n in names)

    asyncio.run(run())


def test_search_site_filter_selects_connector():
    """Régression : le filtre `site` ne doit interroger que le connecteur ciblé."""
    amazon = _make_connector_cls("amazon", [
        ("Produit Amazon", "10,00 €", "https://www.amazon.fr/dp/B000000010"),
    ])
    ebay = _make_connector_cls("ebay", [
        ("Produit eBay", "11,00 €", "https://www.ebay.fr/itm/123456789"),
    ])

    async def run():
        with patch('src.routes.search.CONNECTORS', [amazon, ebay]):
            result = await search_products(SearchPayload(
                query='produit',
                site='ebay',
                maxResults=10,
            ))
            assert result['sources_queried'] == ['ebay']
            assert all('Amazon' not in r['name'] for r in result['results'])

    asyncio.run(run())


def test_proxy_rotation_in_browser():
    """Test that browser session uses proxy rotation when configured."""
    browser_module.proxy_idx = 0

    settings = Settings()
    settings.proxy_list = ['http://proxy1:8080', 'http://proxy2:8080']

    with patch('src.connectors.browser.get_settings', return_value=settings):
        proxy1 = _next_proxy()
        proxy2 = _next_proxy()

        assert proxy1 == 'http://proxy1:8080'
        assert proxy2 == 'http://proxy2:8080'


def test_user_agent_rotation():
    """Test that user agent rotates on each call."""
    browser_module._user_agent_idx = 0

    agents = [_next_user_agent() for _ in range(len(USER_AGENTS) + 2)]

    assert agents[0] == agents[len(USER_AGENTS)]
    assert agents[1] == agents[len(USER_AGENTS) + 1]


def test_negative_keyword_parsing():
    """Test that negative keywords are parsed correctly in intent."""
    import re
    text = "casque bluetooth -airpods -samsung"

    exclude_matches = list(re.finditer(r'-([a-zA-Z0-9]+)', text))
    exclude_keywords = [m.group(1).lower() for m in exclude_matches]
    clean_query = re.sub(r'-[a-zA-Z0-9]+', '', text).strip()

    assert exclude_keywords == ['airpods', 'samsung']
    assert clean_query == 'casque bluetooth'


def test_digest_endpoint():
    """Test that daily digest endpoint returns price drops."""
    result = get_daily_digest()
    assert 'priceDrops' in result
    assert 'generatedAt' in result
    assert 'count' in result


def test_watch_check_prices_endpoint():
    """Test that watch check-prices endpoint returns product list."""
    result = check_watch_prices()
    assert 'checked' in result
    assert 'productIds' in result
    assert isinstance(result['productIds'], list)