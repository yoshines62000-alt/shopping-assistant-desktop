"""Deal-watcher : CRUD des recherches surveillées + dédoublonnage des hits.

Comme les autres tests DB, skip si PostgreSQL est indisponible.
"""

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

TEST_QUERY = "__pytest_saved_search__"


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c
        for s in c.get("/api/v1/watch/searches").json()["searches"]:
            if s["query"] == TEST_QUERY:
                c.delete(f"/api/v1/watch/searches/{s['id']}")


def test_create_list_update_delete(client):
    res = client.post(
        "/api/v1/watch/searches", json={"query": TEST_QUERY, "targetPrice": 42.5}
    )
    assert res.status_code == 200
    created = res.json()
    assert created["query"] == TEST_QUERY
    assert created["targetPrice"] == 42.5
    assert created["active"] is True
    sid = created["id"]

    listed = client.get("/api/v1/watch/searches").json()["searches"]
    assert any(s["id"] == sid for s in listed)

    patched = client.patch(f"/api/v1/watch/searches/{sid}", json={"active": False}).json()
    assert patched["active"] is False

    assert client.delete(f"/api/v1/watch/searches/{sid}").json()["ok"] is True
    assert all(s["id"] != sid for s in client.get("/api/v1/watch/searches").json()["searches"])


def test_record_deal_hits_dedupes(client):
    from src.background import _record_deal_hits
    from src.db import get_session
    from src.models import SavedSearch

    sid = client.post(
        "/api/v1/watch/searches", json={"query": TEST_QUERY, "targetPrice": 100.0}
    ).json()["id"]
    with get_session() as session:
        search = session.get(SavedSearch, sid)

    results = [
        {"id": "pid-a", "name": "Cheap", "totalPrice": 30.0, "sourceUrl": "http://x/a", "siteDomain": "ebay.fr"},
        {"id": "pid-b", "name": "Too dear", "totalPrice": 150.0, "sourceUrl": "http://x/b", "siteDomain": "ebay.fr"},
    ]
    # 1er passage : seul pid-a (<= seuil) est retenu.
    fresh = _record_deal_hits(search, results)
    assert [d["id"] for d in fresh] == ["pid-a"]
    # 2e passage : pid-a déjà vu -> aucune nouveauté (pas de doublon).
    assert _record_deal_hits(search, results) == []

    deals = client.get("/api/v1/watch/deals").json()["deals"]
    assert sum(1 for d in deals if d["productId"] == "pid-a") == 1
