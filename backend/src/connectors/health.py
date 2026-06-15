"""Suivi de sante des connecteurs + circuit breaker (en memoire, par process).

Pour chaque connecteur on retient : derniere tentative, dernier succes, dernier
nombre de resultats, echecs consecutifs et derniere anomalie. Sert a deux choses :

1. Observabilite : `snapshot()` alimente l'endpoint /api/v1/connectors/health
   (savoir d'un coup d'oeil si un connecteur deraille).
2. Circuit breaker : apres N echecs consecutifs (blocage anti-bot ou erreur),
   `should_skip()` saute le connecteur pendant un cooldown -- inutile de relancer
   un navigateur vers un site qui bloque a repetition.

Un resultat VIDE sans blocage n'est PAS compte comme un echec (une recherche
peut legitimement ne rien renvoyer) ; seuls un blocage ou une erreur le sont.
"""

import threading
import time

FAIL_THRESHOLD = 3       # echecs consecutifs avant ouverture du circuit
COOLDOWN_SECONDS = 600   # pause (10 min) quand le circuit est ouvert

_lock = threading.Lock()
_stats: dict[str, dict] = {}


def _entry(site_key: str) -> dict:
    return _stats.setdefault(
        site_key,
        {
            "last_attempt": 0.0,
            "last_success": 0.0,
            "last_count": None,
            "consecutive_failures": 0,
            "last_issue": None,
        },
    )


def record(site_key: str, count: int, issue: str | None = None) -> None:
    """Enregistre le resultat d'une tentative.

    `issue` non vide = echec (blocage anti-bot, erreur reseau...). `count > 0`
    sans issue = succes (remet les echecs a zero).
    """
    with _lock:
        e = _entry(site_key)
        e["last_attempt"] = time.time()
        e["last_count"] = count
        if issue:
            e["last_issue"] = issue
            e["consecutive_failures"] += 1
        elif count > 0:
            e["last_success"] = time.time()
            e["consecutive_failures"] = 0


def should_skip(site_key: str) -> bool:
    """Vrai si le circuit est ouvert (trop d'echecs recents, cooldown en cours)."""
    with _lock:
        e = _stats.get(site_key)
        if not e or e["consecutive_failures"] < FAIL_THRESHOLD:
            return False
        return (time.time() - e["last_attempt"]) < COOLDOWN_SECONDS


def snapshot() -> dict[str, dict]:
    """Etat lisible (pour l'endpoint d'observabilite)."""
    with _lock:
        now = time.time()
        out: dict[str, dict] = {}
        for key, e in _stats.items():
            out[key] = {
                "lastCount": e["last_count"],
                "consecutiveFailures": e["consecutive_failures"],
                "lastIssue": e["last_issue"],
                "secondsSinceSuccess": int(now - e["last_success"]) if e["last_success"] else None,
                "secondsSinceAttempt": int(now - e["last_attempt"]) if e["last_attempt"] else None,
                "circuitOpen": (
                    e["consecutive_failures"] >= FAIL_THRESHOLD
                    and (now - e["last_attempt"]) < COOLDOWN_SECONDS
                ),
            }
        return out


def reset() -> None:
    """Vide l'etat (tests)."""
    with _lock:
        _stats.clear()
