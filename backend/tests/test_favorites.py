"""Favoris : listes (étiquettes multiples) + favoris + annotations. Skip si pas de DB."""

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

PID = "__pytest_fav__"


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c
        # Nettoyage : favoris de test + listes de test.
        for f in c.get("/api/v1/favorites").json()["favorites"]:
            if f["productId"].startswith(PID):
                c.delete(f"/api/v1/favorites/{f['id']}")
        for lst in c.get("/api/v1/favorites/lists").json()["lists"]:
            if lst["name"].startswith("__pytest__"):
                c.delete(f"/api/v1/favorites/lists/{lst['id']}")


def test_listes_crud(client):
    lst = client.post("/api/v1/favorites/lists", json={"name": "__pytest__A", "color": "#f00"}).json()
    assert lst["name"] == "__pytest__A" and lst["count"] == 0
    upd = client.patch(f"/api/v1/favorites/lists/{lst['id']}", json={"name": "__pytest__A2"}).json()
    assert upd["name"] == "__pytest__A2"
    assert client.delete(f"/api/v1/favorites/lists/{lst['id']}").json()["ok"] is True


def test_ajout_etiquettes_multiples_et_filtre(client):
    l1 = client.post("/api/v1/favorites/lists", json={"name": "__pytest__L1"}).json()
    l2 = client.post("/api/v1/favorites/lists", json={"name": "__pytest__L2"}).json()

    fav = client.post(
        "/api/v1/favorites",
        json={"productId": PID + "1", "name": "iPhone", "price": 300, "siteDomain": "ebay.fr",
              "sourceUrl": "http://x/1", "imageUrl": "http://img/1", "listIds": [l1["id"], l2["id"]]},
    ).json()
    assert sorted(fav["listIds"]) == sorted([l1["id"], l2["id"]])  # 2 etiquettes
    assert fav["imageUrl"] == "http://img/1"

    # Filtre par liste : le favori apparait dans L1 et L2.
    assert any(f["id"] == fav["id"] for f in client.get(f"/api/v1/favorites?listId={l1['id']}").json()["favorites"])
    assert any(f["id"] == fav["id"] for f in client.get(f"/api/v1/favorites?listId={l2['id']}").json()["favorites"])

    # Compteur de liste reflete le rattachement.
    lists = {x["id"]: x for x in client.get("/api/v1/favorites/lists").json()["lists"]}
    assert lists[l1["id"]]["count"] == 1


def test_upsert_par_produit_et_annotations(client):
    a = client.post("/api/v1/favorites", json={"productId": PID + "2", "name": "Casque", "price": 100}).json()
    b = client.post("/api/v1/favorites", json={"productId": PID + "2", "name": "Casque", "price": 100}).json()
    assert a["id"] == b["id"]  # pas de doublon (upsert par productId)

    upd = client.patch(f"/api/v1/favorites/{a['id']}", json={"notes": "taille L", "targetPrice": 80}).json()
    assert upd["notes"] == "taille L" and upd["targetPrice"] == 80

    # Retag via PATCH listIds.
    l = client.post("/api/v1/favorites/lists", json={"name": "__pytest__L3"}).json()
    upd2 = client.patch(f"/api/v1/favorites/{a['id']}", json={"listIds": [l["id"]]}).json()
    assert upd2["listIds"] == [l["id"]]


def test_serialise_champs_suivi_prix(client):
    fav = client.post(
        "/api/v1/favorites",
        json={"productId": PID + "p", "name": "Souris", "price": 25, "sourceUrl": "http://x/p"},
    ).json()
    # Champs de suivi présents (null/vide tant qu'aucun rafraîchissement).
    assert "previousPrice" in fav and fav["previousPrice"] is None
    assert "priceCheckedAt" in fav and fav["priceCheckedAt"] is None
    assert fav["priceHistory"] == []


def test_refresh_prix_site_non_supporte(client):
    """Un favori dont l'URL n'est ni Amazon ni eBay renvoie 'unsupported' (pas de scrape)."""
    fav = client.post(
        "/api/v1/favorites",
        json={"productId": PID + "ns", "name": "Truc", "price": 10, "sourceUrl": "http://vinted.fr/x"},
    ).json()
    res = client.post(f"/api/v1/favorites/{fav['id']}/refresh-price").json()
    assert res["status"] == "unsupported"
    # Lot : aucun favori éligible -> 0 vérifié (les favoris de test ne sont pas Amazon/eBay).
    bulk = client.post("/api/v1/favorites/refresh-prices").json()
    assert "checked" in bulk and "changed" in bulk


def test_prix_cible_des_ajout(client):
    """Le prix cible peut être défini dès l'ajout (favori intelligent)."""
    fav = client.post(
        "/api/v1/favorites",
        json={"productId": PID + "tc", "name": "Montre", "price": 120, "targetPrice": 100},
    ).json()
    assert fav["targetPrice"] == 100


def test_alerte_sous_cible_logique():
    """Helper de franchissement : notifie une fois sous la cible, réarme au-dessus."""
    from src.routes.favorites import _target_alert

    # Pas de cible -> jamais de notif.
    assert _target_alert(50, None, False) == (False, False)
    # Passe sous la cible, pas encore notifié -> notifie + arme le flag.
    assert _target_alert(90, 100, False) == (True, True)
    # Toujours sous la cible mais déjà notifié -> silence.
    assert _target_alert(85, 100, True) == (False, True)
    # Repasse au-dessus -> réarme (plus de flag).
    assert _target_alert(110, 100, True) == (False, False)


def test_import_migration(client):
    res = client.post(
        "/api/v1/favorites/import",
        json={"favorites": [
            {"productId": PID + "imp1", "name": "X", "price": 5, "sourceUrl": "http://x/i1"},
            {"productId": PID + "imp1", "name": "X", "price": 5, "sourceUrl": "http://x/i1"},  # doublon ignoré
        ]},
    ).json()
    assert res["imported"] == 1
