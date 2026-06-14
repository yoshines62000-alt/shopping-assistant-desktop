import asyncio
import hashlib
import logging
from contextlib import asynccontextmanager
from datetime import timezone
from typing import Optional

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from fastapi import FastAPI, Body, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from sqlmodel import select
from .config import get_settings
from .db import init_db, get_session
from .models import PriceHistory, Alert, SiteReputation, ProductRef
from .routes.health import router as health_router
from .routes.search import router as search_router
from .routes.deals import router as deals_router
from .routes.arbitrage import router as arbitrage_router
from .routes.connectors import router as connectors_router
from .routes.admin import router as admin_router
from .routes.stock import router as stock_router
from .routes.estimate import router as estimate_router
from .routes.settings import router as settings_router
from .routes.digest import router as digest_router
from .routes.watch import router as watch_router
from .routes.products import router as products_router
from .intent.ollama import parse_intent_with_ollama
from .scripts.seed_trust_lists import seed_trust_lists

logger = logging.getLogger("main")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_ready = False
    try:
        init_db()
        seed_trust_lists()
        db_ready = True
    except Exception as exc:
        logger.warning("Database unavailable at startup: %s", exc)

    stop_event = asyncio.Event()
    task = None
    if db_ready and settings.background_tasks_enabled:
        from .background import background_loop

        task = asyncio.create_task(background_loop(stop_event))
        logger.info("Tâches de fond démarrées (alertes + ré-estimation du stock)")

    yield

    stop_event.set()
    if task:
        task.cancel()


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="Shopping Assistant Scraper",
    description="Multi-site e-commerce scraping and normalization service",
    version="0.1.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, tags=["health"])
app.include_router(search_router, prefix="/api/v1", tags=["search"])
app.include_router(deals_router, prefix="/api/v1", tags=["deals"])
app.include_router(arbitrage_router, prefix="/api/v1", tags=["arbitrage"])
app.include_router(connectors_router, prefix="/api/v1/connectors", tags=["connectors"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(stock_router, prefix="/api/v1", tags=["stock"])
app.include_router(estimate_router, prefix="/api/v1", tags=["estimate"])
app.include_router(settings_router, prefix="/api/v1", tags=["settings"])
app.include_router(digest_router, prefix="/api/v1", tags=["digest"])
app.include_router(watch_router, prefix="/api/v1", tags=["watch"])
app.include_router(products_router, prefix="/api/v1", tags=["products"])

class PriceIngest(BaseModel):
    productId: str = Field(..., min_length=1, max_length=500)
    price: float = Field(..., gt=0)
    connector: str = Field(default="amazon", max_length=100)

def _product_id(source_url: str) -> str:
    return hashlib.sha256(source_url.encode("utf-8")).hexdigest()


def _normalize_alert_product_id(session, product_id: str) -> str:
    if product_id.startswith("http"):
        normalized = _product_id(product_id)
        ref = session.get(ProductRef, normalized) or ProductRef(
            product_id=normalized,
            source_url=product_id,
            site_domain=product_id.split("//", 1)[1].split("/", 1)[0] if "//" in product_id else "",
        )
        ref.source_url = product_id
        session.add(ref)
        return normalized
    return product_id[:500]

class AlertCreate(BaseModel):
    productId: str = Field(..., min_length=1, max_length=2000)
    userId: Optional[str] = Field(default="me", max_length=100)
    thresholdPrice: float = Field(..., gt=0)
    channels: Optional[list[str]] = Field(default=None, max_length=5)

    @field_validator('channels')
    @classmethod
    def validate_channels(cls, v):
        allowed = {'email', 'discord', 'telegram'}
        if v is not None:
            for c in v:
                if c not in allowed:
                    raise ValueError(f'Invalid channel: {c}')
        return v

@app.get("/api/v1/products/{product_id}/history")
@limiter.limit("30/minute")
def get_history(request: Request, product_id: str):
    if len(product_id) > 500:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    with get_session() as session:
        rows = session.exec(
            select(PriceHistory)
            .where(PriceHistory.product_id == product_id)
            .order_by(PriceHistory.observed_at.desc())
            .limit(100)
        ).all()
        return {
            "productId": product_id,
            "history": [
                {
                    "price": r.price,
                    "connector": r.connector,
                    "ts": int(r.observed_at.replace(tzinfo=timezone.utc).timestamp()),
                }
                for r in rows
            ],
        }

@app.post("/api/v1/products/{product_id}/history")
@limiter.limit("60/minute")
def ingest_price(request: Request, product_id: str, body: PriceIngest = Body(...)):
    with get_session() as session:
        row = PriceHistory(product_id=product_id, price=body.price, connector=body.connector)
        session.add(row)
        session.commit()
    return {"ok": True}

@app.post("/api/v1/alerts")
@limiter.limit("30/minute")
def create_alert(request: Request, body: AlertCreate):
    with get_session() as session:
        product_id = _normalize_alert_product_id(session, body.productId)
        alert = Alert(
            user_id=body.userId or "me",
            product_id=product_id,
            threshold_price=body.thresholdPrice,
            channels=",".join(body.channels or ["email"]),
        )
        session.add(alert)
        session.commit()
        session.refresh(alert)
        return {"ok": True, "alertId": str(alert.id)}

@app.get("/api/v1/alerts")
@limiter.limit("30/minute")
def list_alerts(request: Request):
    with get_session() as session:
        rows = session.exec(select(Alert).order_by(Alert.created_at.desc()).limit(100)).all()
        # Noms lisibles : on joint ProductRef pour ne pas n'afficher que des hachés.
        names: dict[str, str] = {}
        ids = [r.product_id for r in rows]
        if ids:
            for ref in session.exec(
                select(ProductRef).where(ProductRef.product_id.in_(ids))
            ).all():
                if ref.name:
                    names[ref.product_id] = ref.name
        return {
            "alerts": [
                {
                    "alertId": str(r.id),
                    "userId": r.user_id,
                    "productId": r.product_id,
                    "name": names.get(r.product_id),
                    "thresholdPrice": r.threshold_price,
                    "channels": r.channels.split(","),
                    "active": r.active,
                    "triggeredAt": r.triggered_at.isoformat() if r.triggered_at else None,
                }
                for r in rows
            ]
        }


@app.delete("/api/v1/alerts/{alert_id}")
@limiter.limit("30/minute")
def delete_alert(request: Request, alert_id: int):
    with get_session() as session:
        alert = session.get(Alert, alert_id)
        if not alert:
            raise HTTPException(status_code=404, detail="Alerte introuvable")
        session.delete(alert)
        session.commit()
        return {"ok": True}

@app.get("/api/v1/trust-lists")
@limiter.limit("10/minute")
def get_trust_lists(request: Request):
    with get_session() as session:
        rows = session.exec(select(SiteReputation)).all()
        return {"sites": [{"domain": r.domain, "trustScore": r.trust_score, "classification": r.classification} for r in rows]}

class IntentRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)

@app.post("/api/v1/intent")
@limiter.limit("60/minute")
def intent_endpoint(request: Request, body: IntentRequest):
    return parse_intent_with_ollama(body.query)

@app.get("/")
def root():
    return {"service": "scraping", "status": "running"}

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "message": str(exc) if str(exc) else "Unknown error"}
    )