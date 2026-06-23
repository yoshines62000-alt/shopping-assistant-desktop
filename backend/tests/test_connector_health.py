"""Tests du suivi de sante des connecteurs + circuit breaker."""

import pytest
from fastapi.testclient import TestClient

from src.connectors import health


@pytest.fixture(autouse=True)
def _reset():
    health.reset()
    yield
    health.reset()


def test_succes_remet_les_echecs_a_zero():
    health.record("amazon", 0, issue="blocage")
    health.record("amazon", 0, issue="blocage")
    health.record("amazon", 5)  # succes
    assert health.snapshot()["amazon"]["consecutiveFailures"] == 0


def test_resultat_vide_sans_blocage_non_compte_comme_echec():
    health.record("ebay", 0)
    health.record("ebay", 0)
    assert health.snapshot()["ebay"]["consecutiveFailures"] == 0
    assert health.should_skip("ebay") is False


def test_circuit_ouvre_apres_le_seuil():
    for _ in range(health.FAIL_THRESHOLD):
        health.record("vinted", 0, issue="API inaccessible")
    assert health.should_skip("vinted") is True
    assert health.snapshot()["vinted"]["circuitOpen"] is True


def test_circuit_ferme_sous_le_seuil():
    health.record("amazon", 0, issue="blocage")
    assert health.should_skip("amazon") is False


def test_circuit_se_referme_apres_le_cooldown():
    for _ in range(health.FAIL_THRESHOLD):
        health.record("amazon", 0, issue="blocage")
    assert health.should_skip("amazon") is True
    # Simule une derniere tentative plus vieille que le cooldown.
    health._stats["amazon"]["last_attempt"] -= health.COOLDOWN_SECONDS + 1
    assert health.should_skip("amazon") is False


def test_connecteur_inconnu_pas_de_skip():
    assert health.should_skip("inconnu") is False


def test_endpoint_test_connecteur_instancie_avant_search(monkeypatch):
    """Garde-fou : l'endpoint /connectors/{id}/test doit INSTANCIER le connecteur
    (CONNECTORS = des classes) avant d'appeler search. Sans instanciation,
    `search` est non-lié -> 'query' manquant. On mocke search pour eviter le
    scraping reel."""
    from src.connectors.amazon import AmazonConnector
    from src.main import app

    monkeypatch.setattr(AmazonConnector, "search", lambda self, query, max_results=5: ["a", "b"])
    with TestClient(app) as client:
        res = client.post("/api/v1/connectors/amazon/test")
        assert res.status_code == 200
        body = res.json()
        assert body["connector"] == "amazon"
        assert body["ok"] is True and body["count"] == 2

    assert client.post("/api/v1/connectors/inconnu/test").status_code == 404


def test_snapshot_structure():
    health.record("amazon", 3)
    s = health.snapshot()["amazon"]
    assert s["lastCount"] == 3
    assert s["secondsSinceSuccess"] is not None
    assert s["circuitOpen"] is False


def test_parser_suspect_apres_pages_vides_repetees():
    """Pages reçues mais 0 résultat (sans blocage) à répétition -> parser suspect,
    sans ouvrir le circuit (le site ne bloque pas)."""
    for _ in range(health.PARSER_SUSPECT_THRESHOLD):
        health.record("ebay", 0, parser_suspect=True)
    s = health.snapshot()["ebay"]
    assert s["parserSuspect"] is True
    assert s["circuitOpen"] is False  # pas un blocage -> pas de circuit breaker
    assert health.should_skip("ebay") is False
    # Un succès efface le soupçon.
    health.record("ebay", 7)
    assert health.snapshot()["ebay"]["parserSuspect"] is False


def test_parser_suspect_notifie_une_seule_fois(monkeypatch):
    calls = []
    monkeypatch.setattr(health, "_notify_async", lambda *a: calls.append(a))
    for _ in range(health.PARSER_SUSPECT_THRESHOLD + 2):
        health.record("amazon", 0, parser_suspect=True)
    parser_calls = [c for c in calls if c[0] == "parser"]
    assert len(parser_calls) == 1 and parser_calls[0][1] == "amazon"


def test_notifie_une_fois_a_l_ouverture_puis_au_retablissement(monkeypatch):
    """Une seule notif 'down' à l'ouverture du circuit, une 'up' au rétablissement."""
    calls = []
    monkeypatch.setattr(health, "_notify_async", lambda *a: calls.append(a))

    # En dessous du seuil : aucune notif.
    for _ in range(health.FAIL_THRESHOLD - 1):
        health.record("vinted", 0, issue="blocage")
    assert calls == []

    # Au seuil exact : une notif 'down'.
    health.record("vinted", 0, issue="blocage")
    assert len(calls) == 1 and calls[0][0] == "down" and calls[0][1] == "vinted"

    # Echec supplementaire : pas de nouvelle notif (deja signale).
    health.record("vinted", 0, issue="blocage")
    assert len(calls) == 1

    # Succes : notif 'up' (retabli).
    health.record("vinted", 4)
    assert len(calls) == 2 and calls[1][0] == "up"
