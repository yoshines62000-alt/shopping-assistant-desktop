
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from src.db import engine
from src.main import app
from src.routes.admin import RestoreBackup, _restore_token, settings


def _db_available() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_available(), reason="PostgreSQL indisponible")


def _payload():
    return {
        "stock": [
            {
                "id": 9001,
                "name": "Objet restore",
                "purchase_price": 10.0,
                "quantity": 1,
                "remaining": 1,
                "status": "in_stock",
            }
        ],
        "sales": [],
        "expenses": [],
        "alerts": [],
        "priceHistory": [],
        "productRefs": [],
        "settings": {"platformFees": {"ebay": 0.13}},
    }


def _restore_body(payload: dict, **overrides):
    body = RestoreBackup(**{**payload, **overrides}, confirm=True)
    return {**body.model_dump(), "confirmationToken": _restore_token(body)}


def test_admin_restore_requires_admin_key(monkeypatch):
    monkeypatch.setattr(settings, "admin_api_key", "test-key")
    with TestClient(app) as client:
        res = client.post("/api/v1/admin/restore", json={"confirm": True})
        assert res.status_code == 401


def test_admin_restore_dry_run_requires_confirmation(monkeypatch):
    monkeypatch.setattr(settings, "admin_api_key", "test-key")
    payload = _payload()
    body = _restore_body(payload, dryRun=True)
    headers = {"X-Admin-Key": "test-key"}

    with TestClient(app) as client:
        res = client.post("/api/v1/admin/restore", json=body, headers=headers)
        assert res.status_code == 200
        assert res.json()["dryRun"] is True
        assert res.json()["wouldRestore"]["stock"] == 1
        assert client.get("/api/v1/stock").json()["items"] == []


def test_admin_restore_json_backup(monkeypatch):
    monkeypatch.setattr(settings, "admin_api_key", "test-key")
    payload = _payload()
    headers = {"X-Admin-Key": "test-key"}

    with TestClient(app) as client:
        res = client.post("/api/v1/admin/restore", json=_restore_body(payload), headers=headers)
        assert res.status_code == 200
        assert res.json()["restored"]["stock"] == 1

        stock = client.get("/api/v1/stock").json()["items"]
        assert any(item["name"] == "Objet restore" for item in stock)

        client.delete("/api/v1/stock/9001")
