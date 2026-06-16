from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json().get("service") == "scraping"


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body.get("status") == "healthy"
    assert "amazon" in body.get("connectors", [])
    assert "ebay" in body.get("connectors", [])


def test_no_fake_connectors_registered():
    """Le système de recherche ne doit contenir que des sources réelles."""
    response = client.get("/api/v1/connectors/")
    connectors = set(response.json()["connectors"])
    assert connectors == {"amazon", "ebay", "vinted", "leboncoin"}
    assert not connectors & {"ai", "static", "dummyjson", "fakestore", "wikidata"}


def test_list_connectors():
    response = client.get("/api/v1/connectors/")
    assert response.status_code == 200
    assert len(response.json().get("connectors", [])) > 0


def test_admin_root():
    response = client.get("/api/v1/admin/")
    assert response.status_code == 200
    assert response.json().get("admin") == "ok"


def test_search_empty_query():
    response = client.post("/api/v1/search", json={"query": ""})
    assert response.status_code == 200
    assert response.json().get("results") == []


def test_product_info_route_registered():
    """Régression : la route fiche produit existait mais n'était pas montée.

    Un produit inconnu doit renvoyer le 404 *applicatif* (détail explicite),
    preuve que le routeur products est bien enregistré et exécuté.
    """
    response = client.get("/api/v1/products/produit-inexistant-xyz")
    assert response.status_code == 404
    assert response.json().get("detail") == "Produit inconnu"


def test_product_history_route_still_distinct():
    """La route /history ne doit pas être masquée par /products/{id}."""
    response = client.get("/api/v1/products/produit-inexistant-xyz/history")
    assert response.status_code == 200
    assert response.json().get("history") == []
