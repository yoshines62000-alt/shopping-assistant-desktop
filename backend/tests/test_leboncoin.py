"""Parser Leboncoin : extraction des annonces depuis __NEXT_DATA__.

Pas de réseau : on vérifie la logique de parsing sur un JSON représentatif
(structure Next.js de leboncoin.fr) et la robustesse face à une page de blocage.
"""

import json

from src.connectors.leboncoin import LeboncoinConnector, parse_search_page

# __NEXT_DATA__ minimal mais fidèle : ads imbriquées sous props.pageProps.searchData.
_NEXT_DATA = {
    "props": {
        "pageProps": {
            "searchData": {
                "total": 2,
                "ads": [
                    {
                        "list_id": 2812345678,
                        "subject": "iPhone 13 128 Go bon état",
                        "price": [320],
                        "url": "/telephonie/2812345678.htm",
                        "location": {"city": "Lyon", "zipcode": "69003"},
                        "owner": {"name": "Marc"},
                        "category_name": "Téléphonie",
                    },
                    {
                        "list_id": 2812345679,
                        "subject": "Coque iPhone (don)",
                        "price": [],  # sans prix -> ignorée
                        "url": "/telephonie/2812345679.htm",
                    },
                    {
                        "list_id": 2812345680,
                        "subject": "Chargeur",
                        "price": [10],
                        "url": "",  # sans URL -> ignorée
                    },
                ],
            }
        }
    }
}


def _html(next_data: dict) -> str:
    return (
        '<html><body><script id="__NEXT_DATA__" type="application/json">'
        + json.dumps(next_data)
        + "</script></body></html>"
    )


def test_parses_valid_ads_only():
    results = parse_search_page(_html(_NEXT_DATA), max_results=10)
    assert len(results) == 1  # les annonces sans prix / sans URL sont écartées
    ad = results[0]
    assert ad.title == "iPhone 13 128 Go bon état"
    assert ad.price_raw == "320 €"
    assert ad.url == "https://www.leboncoin.fr/telephonie/2812345678.htm"
    assert ad.seller == "Marc"
    assert ad.extra["city"] == "Lyon"


def test_respects_max_results():
    many = {"props": {"pageProps": {"ads": [
        {"subject": f"Article {i}", "price": [i + 1], "url": f"/x/{i}.htm"} for i in range(20)
    ]}}}
    assert len(parse_search_page(_html(many), max_results=5)) == 5


def test_no_next_data_returns_empty():
    assert parse_search_page("<html><body>blocked</body></html>", 10) == []


def test_absolute_url_kept_as_is():
    data = {"ads": [{"subject": "Vélo", "price": [90], "url": "https://www.leboncoin.fr/sports/1.htm"}]}
    out = parse_search_page(_html(data), 10)
    assert out and out[0].url == "https://www.leboncoin.fr/sports/1.htm"


def test_connector_metadata():
    assert LeboncoinConnector.site_key == "leboncoin"
    assert LeboncoinConnector.base_url == "https://www.leboncoin.fr"
