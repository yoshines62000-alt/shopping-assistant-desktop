from fastapi import APIRouter, HTTPException
from ..connectors import health
from ..connectors.registry import CONNECTORS

router = APIRouter()

_NEUTRAL = {
    "lastCount": None,
    "consecutiveFailures": 0,
    "lastIssue": None,
    "secondsSinceSuccess": None,
    "secondsSinceAttempt": None,
    "circuitOpen": False,
    "parserSuspect": False,
    "emptyFullPage": 0,
}

@router.get("/")
def list_connectors():
    return {"connectors": [c.site_key for c in CONNECTORS]}

@router.get("/health")
def connectors_health():
    """Sante de chaque connecteur (observabilite scraping)."""
    snap = health.snapshot()
    return {"connectors": {c.site_key: snap.get(c.site_key, dict(_NEUTRAL)) for c in CONNECTORS}}

# Requête-témoin générique : doit renvoyer des résultats sur n'importe quelle
# source qui fonctionne (sinon = blocage ou parser cassé).
_TEST_QUERY = "ordinateur portable"


@router.post("/{connector_id}/test")
def test_connector(connector_id: str):
    """Lance une recherche-témoin réelle sur un connecteur et renvoie l'issue.
    Met aussi à jour la santé (le search enregistre blocage/parser/succès)."""
    by_key = {c.site_key: c for c in CONNECTORS}
    connector_cls = by_key.get(connector_id)
    if connector_cls is None:
        raise HTTPException(status_code=404, detail=f"Unknown connector: {connector_id}")
    try:
        results = connector_cls().search(_TEST_QUERY, max_results=5)  # instancier avant search
    except Exception as exc:  # le search gère deja la plupart des erreurs
        return {"connector": connector_id, "ok": False, "count": 0, "issue": str(exc)[:200]}
    snap = health.snapshot().get(connector_id, {})
    return {
        "connector": connector_id,
        "ok": len(results) > 0,
        "count": len(results),
        "issue": snap.get("lastIssue"),
        "parserSuspect": snap.get("parserSuspect", False),
    }
