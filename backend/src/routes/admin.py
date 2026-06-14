from datetime import datetime, timezone
import hashlib
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlmodel import select as sqlmodel_select

from ..config import get_settings
from ..db import get_session
from ..models import Alert, AppSetting, Expense, PriceHistory, ProductRef, Sale, StockItem
from ..settings_store import get_app_settings

router = APIRouter()
settings = get_settings()


async def require_admin(x_admin_key: str | None = Header(default=None, alias="X-Admin-Key")) -> bool:
    expected = settings.admin_api_key.strip()
    if not expected:
        raise HTTPException(status_code=503, detail="ADMIN_API_KEY non configurée")
    if not x_admin_key or x_admin_key != expected:
        raise HTTPException(status_code=401, detail="Clé admin invalide")
    return True


class RestoreBackup(BaseModel):
    stock: list[dict[str, Any]] = Field(default_factory=list)
    sales: list[dict[str, Any]] = Field(default_factory=list)
    expenses: list[dict[str, Any]] = Field(default_factory=list)
    alerts: list[dict[str, Any]] = Field(default_factory=list)
    priceHistory: list[dict[str, Any]] = Field(default_factory=list)
    productRefs: list[dict[str, Any]] = Field(default_factory=list)
    settings: dict[str, Any] | None = None
    dryRun: bool = False
    confirm: bool = False
    confirmationToken: str | None = None


def _restore_token_payload(body: RestoreBackup) -> dict[str, Any]:
    data = body.model_dump()
    data.pop("confirm", None)
    data.pop("confirmationToken", None)
    return data


def _restore_token(body: RestoreBackup) -> str:
    encoded = json.dumps(
        _restore_token_payload(body),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _require_confirmation(body: RestoreBackup) -> None:
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Confirmation explicite requise")
    if body.confirmationToken != _restore_token(body):
        raise HTTPException(status_code=400, detail="Jeton de confirmation invalide")


def _required(payload: dict[str, Any], key: str) -> Any:
    if key not in payload or payload[key] is None:
        raise HTTPException(status_code=400, detail=f"Champ manquant : {key}")
    return payload[key]


def _restore_datetime(value):
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Date invalide : {value}") from exc
    return value


def _restore_stock_item(payload: dict[str, Any]):
    return StockItem(
        id=payload.get("id"),
        name=_required(payload, "name"),
        purchase_price=_required(payload, "purchase_price"),
        quantity=payload.get("quantity", 1),
        remaining=payload.get("remaining", payload.get("quantity", 1)),
        purchase_date=_restore_datetime(payload.get("purchase_date")) or None,
        source_url=payload.get("source_url", ""),
        estimated_resale=payload.get("estimated_resale"),
        previous_estimate=payload.get("previous_estimate"),
        estimated_at=_restore_datetime(payload.get("estimated_at")),
        status=payload.get("status", "in_stock"),
        notes=payload.get("notes", ""),
        created_at=_restore_datetime(payload.get("created_at")) or None,
    )


def _restore_sale(payload: dict[str, Any]):
    return Sale(
        id=payload.get("id"),
        item_id=_required(payload, "item_id"),
        item_name=payload.get("item_name", ""),
        quantity=payload.get("quantity", 1),
        unit_price=_required(payload, "unit_price"),
        fees=payload.get("fees", 0.0),
        platform=payload.get("platform", ""),
        sale_date=_restore_datetime(payload.get("sale_date")) or None,
    )


def _restore_expense(payload: dict[str, Any]):
    return Expense(
        id=payload.get("id"),
        label=_required(payload, "label"),
        amount=_required(payload, "amount"),
        category=payload.get("category", "autre"),
        expense_date=_restore_datetime(payload.get("expense_date")) or None,
    )


def _restore_alert(payload: dict[str, Any]):
    return Alert(
        id=payload.get("id"),
        user_id=payload.get("user_id", "me"),
        product_id=_required(payload, "product_id"),
        threshold_price=_required(payload, "threshold_price"),
        channels=payload.get("channels", "email"),
        active=payload.get("active", True),
        triggered_at=_restore_datetime(payload.get("triggered_at")),
        created_at=_restore_datetime(payload.get("created_at")) or None,
    )


def _restore_price_history(payload: dict[str, Any]):
    return PriceHistory(
        id=payload.get("id"),
        product_id=_required(payload, "product_id"),
        price=_required(payload, "price"),
        connector=payload.get("connector", "unknown"),
        observed_at=_restore_datetime(payload.get("observed_at")) or None,
    )


def _restore_product_ref(payload: dict[str, Any]):
    return ProductRef(
        product_id=_required(payload, "product_id"),
        source_url=_required(payload, "source_url"),
        name=payload.get("name", ""),
        site_domain=payload.get("site_domain", ""),
        updated_at=_restore_datetime(payload.get("updated_at")) or None,
    )


@router.get("/")
def admin_root():
    return {"admin": "ok"}


@router.get("/export")
def export_backup():
    """Sauvegarde JSON complète des données métier (stock, ventes, dépenses, alertes)."""
    with get_session() as session:
        items = session.exec(sqlmodel_select(StockItem)).all()
        sales = session.exec(sqlmodel_select(Sale)).all()
        expenses = session.exec(sqlmodel_select(Expense)).all()
        alerts = session.exec(sqlmodel_select(Alert)).all()
        price_history = session.exec(sqlmodel_select(PriceHistory)).all()
        product_refs = session.exec(sqlmodel_select(ProductRef)).all()
        history_count = len(price_history)

    def dump(rows):
        return [row.model_dump(mode="json") for row in rows]

    return {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "stock": dump(items),
        "sales": dump(sales),
        "expenses": dump(expenses),
        "alerts": dump(alerts),
        "productRefs": dump(product_refs),
        "priceHistory": dump(price_history),
        "settings": get_app_settings(),
        "priceHistoryCount": history_count,
    }


def _delete_all(session, model) -> int:
    return session.execute(delete(model)).rowcount or 0


@router.post("/restore")
def restore_backup(body: RestoreBackup, _: bool = Depends(require_admin)):
    """Restaure une sauvegarde JSON exportée par /admin/export."""
    _require_confirmation(body)

    restored_stock = [_restore_stock_item(item) for item in body.stock]
    restored_sales = [_restore_sale(item) for item in body.sales]
    restored_expenses = [_restore_expense(item) for item in body.expenses]
    restored_alerts = [_restore_alert(item) for item in body.alerts]
    restored_history = [_restore_price_history(item) for item in body.priceHistory]
    restored_refs = [_restore_product_ref(item) for item in body.productRefs]

    counts = {
        "stock": len(restored_stock),
        "sales": len(restored_sales),
        "expenses": len(restored_expenses),
        "alerts": len(restored_alerts),
        "priceHistory": len(restored_history),
        "productRefs": len(restored_refs),
    }

    if body.dryRun:
        return {
            "ok": True,
            "dryRun": True,
            "wouldRestore": counts,
            "confirmationToken": _restore_token(body),
        }

    with get_session() as session:
        delete_counts = {
            "sales": _delete_all(session, Sale),
            "priceHistory": _delete_all(session, PriceHistory),
            "alerts": _delete_all(session, Alert),
            "productRefs": _delete_all(session, ProductRef),
            "stock": _delete_all(session, StockItem),
            "expenses": _delete_all(session, Expense),
        }
        session.flush()

        session.add_all(restored_stock)
        session.add_all(restored_sales)
        session.add_all(restored_expenses)
        session.add_all(restored_alerts)
        session.add_all(restored_history)
        session.add_all(restored_refs)

        if body.settings is not None:
            row = session.get(AppSetting, "app") or AppSetting(key="app")
            row.value = json.dumps(body.settings, ensure_ascii=False, sort_keys=True)
            session.add(row)

        session.commit()

    return {
        "ok": True,
        "dryRun": False,
        "deleted": delete_counts,
        "restored": counts,
    }
