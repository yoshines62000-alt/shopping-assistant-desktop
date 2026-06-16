"""Sauvegarde / restauration (F22) : export puis ré-import. Skip si pas de DB."""

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

MARK = "__pytest_backup__"


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c
        for s in c.get("/api/v1/stock").json().get("items", []):
            if s["name"] == MARK:
                c.delete(f"/api/v1/stock/{s['id']}")


def test_export_has_tables_and_counts(client):
    client.post("/api/v1/stock", json={"name": MARK, "purchasePrice": 10.0, "quantity": 1})
    data = client.get("/api/v1/backup/export").json()
    assert data["version"] == 1
    assert "stockItems" in data["tables"]
    assert data["counts"]["stockItems"] >= 1
    assert any(r["name"] == MARK for r in data["tables"]["stockItems"])


def test_import_round_trip(client):
    created = client.post(
        "/api/v1/stock", json={"name": MARK, "purchasePrice": 7.0, "quantity": 1}
    ).json()["item"]
    backup = client.get("/api/v1/backup/export").json()

    # Réimporte uniquement la table stockItems (replace) : doit reposer la ligne.
    payload = {"version": 1, "tables": {"stockItems": backup["tables"]["stockItems"]}, "replace": True}
    res = client.post("/api/v1/backup/import", json=payload).json()
    assert res["restored"]["stockItems"] >= 1
    assert res["errors"] == []

    items = client.get("/api/v1/stock").json()["items"]
    assert any(i["id"] == created["id"] and i["name"] == MARK for i in items)
