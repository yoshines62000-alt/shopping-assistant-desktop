import json

from src.connectors.vinted import parse_catalog_json

SAMPLE = json.dumps(
    {
        "items": [
            {
                "id": 9145763178,
                "title": "Casque Bluetooth",
                "price": {"amount": "42.8", "currency_code": "EUR"},
                "url": "https://www.vinted.fr/items/9145763178-casque-bluetooth",
                "user": {"login": "vendeur42", "positive_feedback_count": 128},
                "brand_title": "JBL",
            },
            {
                # Sans URL : ignoré
                "id": 1,
                "title": "Sans lien",
                "price": {"amount": "10.0"},
                "url": "",
            },
            {
                # Sans prix : ignoré
                "id": 2,
                "title": "Sans prix",
                "url": "https://www.vinted.fr/items/2-sans-prix",
            },
        ]
    }
)


def test_parse_valid_items_only():
    results = parse_catalog_json(SAMPLE, max_results=10)
    assert len(results) == 1
    item = results[0]
    assert item.title == "Casque Bluetooth"
    assert item.url == "https://www.vinted.fr/items/9145763178-casque-bluetooth"
    assert item.price_raw == "42.8 €"
    assert item.seller == "vendeur42"


def test_parse_invalid_json():
    assert parse_catalog_json("not json", 10) == []
    assert parse_catalog_json("{}", 10) == []
