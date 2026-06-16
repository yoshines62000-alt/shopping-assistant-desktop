"""Catégorisation automatique des dépenses (F15) — fonction pure, sans DB."""

import pytest

from src.routes.stock import _auto_category


@pytest.mark.parametrize(
    "label,expected",
    [
        ("Cartons 30x20", "emballage"),
        ("Rouleau de scotch", "emballage"),
        ("Essence trajet dépôt", "transport"),
        ("Timbres La Poste", "transport"),
        ("Abonnement Vinted Pro", "abonnement"),
        ("Balance de cuisine", "materiel"),
        ("Truc indéfini", "autre"),
    ],
)
def test_auto_category(label, expected):
    assert _auto_category(label) == expected
