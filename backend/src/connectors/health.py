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
# Pages recues correctement (ni blocage ni erreur) mais 0 resultat extrait,
# consecutives, avant de suspecter un parser casse (le site a change sa mise en
# page). Plus haut que FAIL_THRESHOLD pour eviter les faux positifs (recherches
# legitimement vides).
PARSER_SUSPECT_THRESHOLD = 4

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
            "notified": False,  # une seule notif par episode de panne (#4)
            "empty_full_page": 0,  # pages OK mais 0 resultat extrait, consecutives
            "parser_suspect": False,  # parser probablement casse (selecteurs changes)
            "parser_notified": False,  # une seule notif par episode de parser casse
        },
    )


def _notify_async(kind: str, site_key: str, issue: str | None, count: int) -> None:
    """Notifie (en fond, multi-canal) qu'un connecteur tombe ou se retablit.
    Silencieux si aucun canal configure ; jamais bloquant pour la recherche."""

    def _send() -> None:
        try:
            from ..notifications import notify_all
        except Exception:
            return
        if kind == "down":
            notify_all(
                f"⚠️ Connecteur {site_key} en panne : {count} échecs consécutifs "
                f"({issue}). Scraping suspendu temporairement (cooldown). "
                f"Le site a peut-être changé ou bloque (anti-bot).",
                subject=f"Connecteur dégradé : {site_key}",
            )
        elif kind == "parser":
            notify_all(
                f"🔧 Connecteur {site_key} : page reçue mais plus aucun résultat "
                f"extrait sur {count} recherches. Le site a probablement changé sa "
                f"mise en page — le parser (sélecteurs) est sans doute à mettre à jour. "
                f"Les prix/estimations de cette source ne sont plus fiables en attendant.",
                subject=f"Parser à vérifier : {site_key}",
            )
        else:
            notify_all(
                f"✅ Connecteur {site_key} rétabli ({count} résultats).",
                subject=f"Connecteur rétabli : {site_key}",
            )

    threading.Thread(target=_send, daemon=True).start()


def record(site_key: str, count: int, issue: str | None = None, parser_suspect: bool = False) -> None:
    """Enregistre le resultat d'une tentative.

    `issue` non vide = echec dur (blocage anti-bot, erreur reseau...). `count > 0`
    sans issue = succes (remet tout a zero). `parser_suspect=True` (page recue
    correctement mais 0 resultat extrait, sans blocage) = panne SILENCIEUSE
    probable du parser : on la suit a part (pas de circuit breaker, le site ne
    bloque pas) et on notifie au seuil. Notifie aussi tombee/retablissement.
    """
    transition: tuple[str, str, str | None, int] | None = None
    with _lock:
        e = _entry(site_key)
        e["last_attempt"] = time.time()
        e["last_count"] = count
        if issue:
            e["last_issue"] = issue
            e["consecutive_failures"] += 1
            e["empty_full_page"] = 0  # un blocage n'est pas un parser casse
            if e["consecutive_failures"] == FAIL_THRESHOLD and not e["notified"]:
                e["notified"] = True
                transition = ("down", site_key, issue, e["consecutive_failures"])
        elif count > 0:
            was_down = e["notified"]
            e["last_success"] = time.time()
            e["consecutive_failures"] = 0
            e["notified"] = False
            e["empty_full_page"] = 0
            e["parser_suspect"] = False
            e["parser_notified"] = False
            if was_down:
                transition = ("up", site_key, None, count)
        elif parser_suspect:
            e["empty_full_page"] += 1
            if e["empty_full_page"] >= PARSER_SUSPECT_THRESHOLD:
                e["parser_suspect"] = True
                if not e["parser_notified"]:
                    e["parser_notified"] = True
                    transition = ("parser", site_key, None, e["empty_full_page"])
    if transition:
        _notify_async(*transition)


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
                "parserSuspect": e["parser_suspect"],
                "emptyFullPage": e["empty_full_page"],
            }
        return out


def reset() -> None:
    """Vide l'etat (tests)."""
    with _lock:
        _stats.clear()
