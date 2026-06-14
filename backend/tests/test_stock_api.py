import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from src.db import engine
from src.main import app


def _db_available() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_available(), reason="PostgreSQL indisponible")

TEST_NAME = "__pytest_stock_item__"


@pytest.fixture()
def client():
    # Le context manager déclenche le lifespan (init_db → création des tables)
    with TestClient(app) as c:
        yield c
        # Nettoyage : supprime tout objet de test résiduel (et ses ventes)
        items = c.get("/api/v1/stock").json()["items"]
        for item in items:
            if item["name"] == TEST_NAME:
                c.delete(f"/api/v1/stock/{item['id']}")


def _create(client, **overrides):
    payload = {"name": TEST_NAME, "purchasePrice": 50.0, "quantity": 2, **overrides}
    res = client.post("/api/v1/stock", json=payload)
    assert res.status_code == 200
    return res.json()["item"]


def test_create_and_list(client):
    item = _create(client, estimatedResale=80.0)
    assert item["remaining"] == 2
    assert item["status"] == "in_stock"
    listed = client.get("/api/v1/stock").json()["items"]
    assert any(i["id"] == item["id"] for i in listed)


def test_partial_sale_then_full_sale(client):
    item = _create(client)
    res = client.post(
        f"/api/v1/stock/{item['id']}/sell",
        json={"quantity": 1, "unitPrice": 80.0, "fees": 10.0, "platform": "eBay"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["item"]["remaining"] == 1
    assert body["item"]["status"] == "in_stock"
    assert body["sale"]["total"] == 70.0  # 80 - 10 de frais

    res = client.post(f"/api/v1/stock/{item['id']}/sell", json={"quantity": 1, "unitPrice": 75.0})
    assert res.json()["item"]["status"] == "sold"
    assert res.json()["item"]["remaining"] == 0


def test_cannot_oversell(client):
    item = _create(client, quantity=1)
    res = client.post(f"/api/v1/stock/{item['id']}/sell", json={"quantity": 2, "unitPrice": 10.0})
    assert res.status_code == 400


def test_cancel_sale_restores_stock(client):
    item = _create(client, quantity=1)
    sale = client.post(
        f"/api/v1/stock/{item['id']}/sell", json={"quantity": 1, "unitPrice": 99.0}
    ).json()["sale"]

    res = client.delete(f"/api/v1/sales/{sale['id']}")
    assert res.status_code == 200
    refreshed = [i for i in client.get("/api/v1/stock").json()["items"] if i["id"] == item["id"]][0]
    assert refreshed["remaining"] == 1
    assert refreshed["status"] == "in_stock"


def test_status_update_and_validation(client):
    item = _create(client)
    res = client.patch(f"/api/v1/stock/{item['id']}", json={"status": "listed"})
    assert res.json()["item"]["status"] == "listed"
    res = client.patch(f"/api/v1/stock/{item['id']}", json={"status": "n_importe_quoi"})
    assert res.status_code == 400


def test_accounting_summary_reflects_sale(client):
    item = _create(client, quantity=1, purchasePrice=40.0)
    client.post(
        f"/api/v1/stock/{item['id']}/sell",
        json={"quantity": 1, "unitPrice": 100.0, "fees": 13.0},
    )
    summary = client.get("/api/v1/accounting/summary").json()
    assert summary["revenueGross"] >= 100.0
    assert summary["feesTotal"] >= 13.0
    # bénéfice de cette vente : 100 - 13 - 40 = 47, inclus dans le total
    assert summary["salesCount"] >= 1
    assert summary["monthly"], "le détail mensuel doit contenir la vente"


def test_accounting_summary_stock_potential_net_is_profit(client):
    before = client.get("/api/v1/accounting/summary").json()
    item = _create(client, quantity=2, purchasePrice=100.0, estimatedResale=150.0)
    client.post(
        f"/api/v1/stock/{item['id']}/sell",
        json={"quantity": 1, "unitPrice": 120.0, "fees": 0.0},
    )

    summary = client.get("/api/v1/accounting/summary").json()

    assert summary["itemsInStock"] == before["itemsInStock"] + 1
    assert summary["stockValue"] == before["stockValue"] + 100.0
    assert summary["stockPotentialNet"] == before["stockPotentialNet"] + 30.5
