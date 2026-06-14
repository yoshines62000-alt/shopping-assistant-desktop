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


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c
        # Nettoyage des dépenses de test
        for e in c.get("/api/v1/expenses").json()["expenses"]:
            if e["label"] == "__pytest_expense__":
                c.delete(f"/api/v1/expenses/{e['id']}")


def test_settings_defaults_and_update(client):
    settings = client.get("/api/v1/settings").json()
    assert "platformFees" in settings
    assert settings["platformFees"]["ebay"] > 0

    res = client.put("/api/v1/settings", json={"platformFees": {"ebay": 0.15}})
    assert res.status_code == 200
    assert res.json()["platformFees"]["ebay"] == 0.15
    # Les autres plateformes ne sont pas écrasées par la mise à jour partielle
    assert "vinted" in res.json()["platformFees"]

    # Retour à la valeur par défaut
    client.put("/api/v1/settings", json={"platformFees": {"ebay": 0.13}})


def test_settings_validation(client):
    assert client.put("/api/v1/settings", json={"platformFees": {"ebay": 5.0}}).status_code == 400
    assert (
        client.put("/api/v1/settings", json={"discordWebhookUrl": "http://evil.com"}).status_code
        == 400
    )


def test_expense_crud_and_summary(client):
    created = client.post(
        "/api/v1/expenses",
        json={"label": "__pytest_expense__", "amount": 12.5, "category": "emballage"},
    )
    assert created.status_code == 200
    expense_id = created.json()["expense"]["id"]

    summary = client.get("/api/v1/accounting/summary").json()
    assert summary["expensesTotal"] >= 12.5
    assert summary["profitNet"] == round(summary["profitRealized"] - summary["expensesTotal"], 2)
    assert "roiPct" in summary
    assert "topProducts" in summary

    assert client.delete(f"/api/v1/expenses/{expense_id}").json()["ok"] is True


def test_backup_export(client):
    data = client.get("/api/v1/admin/export").json()
    assert "stock" in data and "sales" in data and "expenses" in data and "settings" in data
    assert data["exportedAt"]
