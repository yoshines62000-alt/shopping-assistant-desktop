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
}

@router.get("/")
def list_connectors():
    return {"connectors": [c.site_key for c in CONNECTORS]}

@router.get("/health")
def connectors_health():
    """Sante de chaque connecteur (observabilite scraping)."""
    snap = health.snapshot()
    return {"connectors": {c.site_key: snap.get(c.site_key, dict(_NEUTRAL)) for c in CONNECTORS}}

@router.post("/{connector_id}/test")
def test_connector(connector_id: str):
    known = {c.site_key for c in CONNECTORS}
    if connector_id not in known:
        raise HTTPException(status_code=404, detail=f"Unknown connector: {connector_id}")
    return {"connector": connector_id, "status": "ok"}
