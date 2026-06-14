"""Tests de la chasse automatique aux bonnes affaires (/deals)."""

import asyncio
from unittest.mock import patch

from src.connectors.base import ProductRaw
from src.routes.deals import deals_scan


class _FakeConnector:
    def __init__(self, site_key, items):
        self.site_key = site_key
        self._items = items

    def search(self, query, max_results=20):
        return self._items[:max_results]


def _connector_cls(site_key, items):
    raws = [
        ProductRaw(
            title=t,
            price_raw=p,
            delivery_raw="",
            seller=site_key,
            reviews_raw="",
            url=u,
            extra={"site": f"{site_key}.fr"},
        )
        for t, p, u in items
    ]

    def factory():
        return _FakeConnector(site_key, raws)

    factory.site_key = site_key
    factory.__name__ = f"{site_key}Fake"
    return factory


def _fake_estimate(name, purchase_price=None, platform="ebay", max_samples=25):
    """Revente médiane simulée par produit (frais nuls pour simplifier)."""
    medians = {"Console retro": 120.0, "Vieux cable": 4.0}
    median = medians.get(name, 0.0)
    price = float(purchase_price or 0)
    if median <= 0:
        return {"query": name, "sampleCount": 0, "soldListings": []}
    net = median  # feeRate 0 dans ce test
    return {
        "query": name,
        "sampleCount": 6,
        "median": median,
        "netEstimate": net,
        "estimatedProfit": round(net - price, 2),
        "marginPct": round((net - price) / price * 100, 1) if price else None,
        "soldListings": [],
    }


def test_deals_ranked_by_margin():
    amazon = _connector_cls(
        "amazon",
        [
            ("Console retro", "60,00 €", "https://www.amazon.fr/dp/B000000001"),
            ("Vieux cable", "10,00 €", "https://www.amazon.fr/dp/B000000002"),
        ],
    )

    async def run():
        with patch("src.routes.search.CONNECTORS", [amazon]), patch(
            "src.routes.deals.estimate_resale", side_effect=_fake_estimate
        ):
            res = await deals_scan({"query": "lot", "maxResults": 2})
            deals = res["deals"]
            assert len(deals) == 2
            # Console : 120-60 = +60 ; Cable : 4-10 = -6  ->  console en tête
            assert deals[0]["name"] == "Console retro"
            assert deals[0]["resale"]["marginEur"] == 60.0
            assert deals[1]["name"] == "Vieux cable"
            assert deals[1]["resale"]["marginEur"] == -6.0

    asyncio.run(run())


def test_deals_handles_no_resale_data():
    amazon = _connector_cls(
        "amazon",
        [("Objet inconnu", "20,00 €", "https://www.amazon.fr/dp/B000000003")],
    )

    async def run():
        with patch("src.routes.search.CONNECTORS", [amazon]), patch(
            "src.routes.deals.estimate_resale", side_effect=_fake_estimate
        ):
            res = await deals_scan({"query": "objet", "maxResults": 3})
            assert len(res["deals"]) == 1
            assert res["deals"][0]["resale"] is None

    asyncio.run(run())


def test_deals_empty_query():
    async def run():
        res = await deals_scan({"query": ""})
        assert res["deals"] == []

    asyncio.run(run())
