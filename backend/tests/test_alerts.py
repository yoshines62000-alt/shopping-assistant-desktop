import re

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


def test_create_alert_accepts_product_url():
    with TestClient(app) as client:
        res = client.post(
            "/api/v1/alerts",
            json={
                "productId": "https://www.amazon.fr/dp/B000000001",
                "thresholdPrice": 12.5,
                "channels": ["discord"],
            },
        )
        assert res.status_code == 200
        alert_id = res.json()["alertId"]

        alerts = client.get("/api/v1/alerts").json()["alerts"]
        alert = next(a for a in alerts if a["alertId"] == alert_id)
        assert re.fullmatch(r"[0-9a-f]{64}", alert["productId"])
        assert alert["channels"] == ["discord"]
        assert alert["thresholdPrice"] == 12.5
