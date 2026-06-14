from fastapi import APIRouter, HTTPException
from ..connectors.registry import CONNECTORS

router = APIRouter()

@router.get("/")
def list_connectors():
    return {"connectors": [c.site_key for c in CONNECTORS]}

@router.post("/{connector_id}/test")
def test_connector(connector_id: str):
    known = {c.site_key for c in CONNECTORS}
    if connector_id not in known:
        raise HTTPException(status_code=404, detail=f"Unknown connector: {connector_id}")
    return {"connector": connector_id, "status": "ok"}
