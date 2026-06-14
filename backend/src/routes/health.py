from fastapi import APIRouter, Response
import time
from sqlmodel import func, select
from ..config import get_settings

router = APIRouter()
START_TIME = time.time()

@router.get("/health")
def get_health():
    from ..connectors.registry import CONNECTORS
    return {"status": "healthy", "connectors": [c.site_key for c in CONNECTORS]}

@router.get("/health/ready")
def get_readiness():
    return {"ready": True}

@router.get("/health/metrics")
def get_metrics():
    settings = get_settings()
    metrics = []
    
    # App metrics
    metrics.append(f'shopping_assistant_uptime_seconds {int(time.time() - START_TIME)}')
    metrics.append(f'shopping_assistant_cache_ttl_seconds {settings.cache_ttl_seconds}')
    
    # Redis metrics : ping reel (timeout court) puis fermeture, sinon la
    # connexion fuit et l'etat etait toujours rapporte "connecte".
    try:
        import redis as redis_sync
        client = redis_sync.from_url(
            settings.redis_url, socket_connect_timeout=0.5, socket_timeout=0.5
        )
        try:
            client.ping()
            metrics.append('shopping_assistant_redis_connected 1')
        finally:
            client.close()
    except Exception:
        metrics.append('shopping_assistant_redis_connected 0')
    
    # DB metrics
    try:
        from ..db import get_session
        from ..models import PriceHistory, Alert
        
        with get_session() as session:
            total_products = session.exec(select(func.count()).select_from(PriceHistory)).one()
            active_alerts = session.exec(
                select(func.count()).select_from(Alert).where(Alert.active)
            ).one()
        
        metrics.append(f'shopping_assistant_db_products {total_products}')
        metrics.append(f'shopping_assistant_db_active_alerts {active_alerts}')
        metrics.append('shopping_assistant_db_connected 1')
    except Exception:
        metrics.append('shopping_assistant_db_connected 0')
    
    return Response(
        content='\n'.join(metrics) + '\n',
        media_type='text/plain'
    )