"""Tests du suivi de sante des connecteurs + circuit breaker."""

import pytest

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


def test_snapshot_structure():
    health.record("amazon", 3)
    s = health.snapshot()["amazon"]
    assert s["lastCount"] == 3
    assert s["secondsSinceSuccess"] is not None
    assert s["circuitOpen"] is False
