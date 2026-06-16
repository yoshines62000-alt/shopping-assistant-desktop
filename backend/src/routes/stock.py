from collections import defaultdict
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import select

from ..config import get_settings
from ..db import get_session
from ..models import Expense, Sale, StockItem

router = APIRouter()

ALLOWED_STATUSES = {"in_stock", "listed", "sold"}


class StockCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    purchasePrice: float = Field(..., ge=0)
    quantity: int = Field(default=1, ge=1, le=9999)
    purchaseDate: Optional[datetime] = None
    sourceUrl: str = Field(default="", max_length=1000)
    estimatedResale: Optional[float] = Field(default=None, ge=0)
    category: str = Field(default="", max_length=100)
    notes: str = Field(default="", max_length=2000)


class StockUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=300)
    purchasePrice: Optional[float] = Field(default=None, ge=0)
    estimatedResale: Optional[float] = Field(default=None, ge=0)
    status: Optional[str] = None
    category: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = Field(default=None, max_length=2000)
    sourceUrl: Optional[str] = Field(default=None, max_length=1000)


class SellRequest(BaseModel):
    quantity: int = Field(default=1, ge=1, le=9999)
    unitPrice: float = Field(..., ge=0)
    fees: float = Field(default=0.0, ge=0)
    platform: str = Field(default="", max_length=100)
    saleDate: Optional[datetime] = None


def _item_to_dict(item: StockItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "name": item.name,
        "purchasePrice": item.purchase_price,
        "quantity": item.quantity,
        "remaining": item.remaining,
        "purchaseDate": item.purchase_date.isoformat(),
        "sourceUrl": item.source_url,
        "estimatedResale": item.estimated_resale,
        "previousEstimate": item.previous_estimate,
        "estimatedAt": item.estimated_at.isoformat() if item.estimated_at else None,
        "status": item.status,
        "category": item.category,
        "notes": item.notes,
    }


def _sale_to_dict(sale: Sale) -> dict[str, Any]:
    return {
        "id": sale.id,
        "itemId": sale.item_id,
        "itemName": sale.item_name,
        "quantity": sale.quantity,
        "unitPrice": sale.unit_price,
        "fees": sale.fees,
        "platform": sale.platform,
        "saleDate": sale.sale_date.isoformat(),
        "total": round(sale.unit_price * sale.quantity - sale.fees, 2),
    }


@router.get("/stock")
def list_stock():
    with get_session() as session:
        items = session.exec(select(StockItem).order_by(StockItem.created_at.desc())).all()
        return {"items": [_item_to_dict(i) for i in items]}


@router.post("/stock")
def create_stock(body: StockCreate):
    with get_session() as session:
        item = StockItem(
            name=body.name.strip(),
            purchase_price=body.purchasePrice,
            quantity=body.quantity,
            remaining=body.quantity,
            source_url=body.sourceUrl.strip(),
            estimated_resale=body.estimatedResale,
            category=body.category.strip(),
            notes=body.notes.strip(),
        )
        if body.purchaseDate is not None:
            item.purchase_date = body.purchaseDate.replace(tzinfo=None)
        session.add(item)
        session.commit()
        session.refresh(item)
        return {"ok": True, "item": _item_to_dict(item)}


@router.patch("/stock/{item_id}")
def update_stock(item_id: int, body: StockUpdate):
    with get_session() as session:
        item = session.get(StockItem, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Objet introuvable")
        if body.status is not None:
            if body.status not in ALLOWED_STATUSES:
                raise HTTPException(status_code=400, detail=f"Statut invalide : {body.status}")
            item.status = body.status
        if body.name is not None:
            item.name = body.name.strip()
        if body.purchasePrice is not None:
            item.purchase_price = body.purchasePrice
        if body.estimatedResale is not None:
            item.estimated_resale = body.estimatedResale
        if body.category is not None:
            item.category = body.category.strip()
        if body.notes is not None:
            item.notes = body.notes.strip()
        if body.sourceUrl is not None:
            item.source_url = body.sourceUrl.strip()
        session.add(item)
        session.commit()
        session.refresh(item)
        return {"ok": True, "item": _item_to_dict(item)}


@router.delete("/stock/{item_id}")
def delete_stock(item_id: int):
    with get_session() as session:
        item = session.get(StockItem, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Objet introuvable")
        # Supprime aussi les ventes liées (l'historique compta de cet objet disparaît)
        for sale in session.exec(select(Sale).where(Sale.item_id == item_id)).all():
            session.delete(sale)
        session.delete(item)
        session.commit()
        return {"ok": True}


@router.post("/stock/{item_id}/sell")
def sell_stock(item_id: int, body: SellRequest):
    with get_session() as session:
        item = session.get(StockItem, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Objet introuvable")
        if body.quantity > item.remaining:
            raise HTTPException(
                status_code=400,
                detail=f"Quantité invalide : il reste {item.remaining} exemplaire(s) en stock",
            )
        sale = Sale(
            item_id=item_id,
            item_name=item.name,
            quantity=body.quantity,
            unit_price=body.unitPrice,
            fees=body.fees,
            platform=body.platform.strip(),
        )
        if body.saleDate is not None:
            sale.sale_date = body.saleDate.replace(tzinfo=None)
        item.remaining -= body.quantity
        if item.remaining == 0:
            item.status = "sold"
        session.add(sale)
        session.add(item)
        session.commit()
        session.refresh(sale)
        session.refresh(item)
        return {"ok": True, "sale": _sale_to_dict(sale), "item": _item_to_dict(item)}


@router.get("/sales")
def list_sales():
    with get_session() as session:
        sales = session.exec(select(Sale).order_by(Sale.sale_date.desc())).all()
        return {"sales": [_sale_to_dict(s) for s in sales]}


@router.delete("/sales/{sale_id}")
def delete_sale(sale_id: int):
    """Annule une vente (erreur de saisie) : la quantité revient en stock."""
    with get_session() as session:
        sale = session.get(Sale, sale_id)
        if not sale:
            raise HTTPException(status_code=404, detail="Vente introuvable")
        item = session.get(StockItem, sale.item_id)
        if item:
            item.remaining += sale.quantity
            if item.status == "sold" and item.remaining > 0:
                item.status = "in_stock"
            session.add(item)
        session.delete(sale)
        session.commit()
        return {"ok": True}


class ExpenseCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=300)
    amount: float = Field(..., gt=0)
    category: str = Field(default="autre", max_length=100)
    expenseDate: Optional[datetime] = None


def _expense_to_dict(e: Expense) -> dict[str, Any]:
    return {
        "id": e.id,
        "label": e.label,
        "amount": e.amount,
        "category": e.category,
        "expenseDate": e.expense_date.isoformat(),
    }


@router.get("/expenses")
def list_expenses():
    with get_session() as session:
        expenses = session.exec(select(Expense).order_by(Expense.expense_date.desc())).all()
        return {"expenses": [_expense_to_dict(e) for e in expenses]}


# Catégorisation automatique (F15) : mots-clés -> catégorie. Appliquée quand
# l'utilisateur n'a pas choisi de catégorie explicite (défaut "autre").
_CATEGORY_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("emballage", ("carton", "emballage", "scotch", "bulle", "pochette", "enveloppe", "etiquette", "étiquette")),
    ("transport", ("essence", "carburant", "peage", "péage", "train", "sncf", "metro", "métro", "bus", "parking", "colissimo", "mondial relay", "chronopost", "livraison", "port", "timbre")),
    ("abonnement", ("abonnement", "premium", "vinted pro", "ebay shop", "boutique", "mensuel")),
    ("materiel", ("balance", "imprimante", "encre", "rangement", "etagere", "étagère", "bac")),
]


def _auto_category(label: str) -> str:
    low = label.lower()
    for category, keywords in _CATEGORY_KEYWORDS:
        if any(k in low for k in keywords):
            return category
    return "autre"


@router.post("/expenses")
def create_expense(body: ExpenseCreate):
    category = body.category.strip()
    if not category or category == "autre":
        category = _auto_category(body.label)
    with get_session() as session:
        expense = Expense(label=body.label.strip(), amount=body.amount, category=category)
        if body.expenseDate is not None:
            expense.expense_date = body.expenseDate.replace(tzinfo=None)
        session.add(expense)
        session.commit()
        session.refresh(expense)
        return {"ok": True, "expense": _expense_to_dict(expense)}


@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int):
    with get_session() as session:
        expense = session.get(Expense, expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="Dépense introuvable")
        session.delete(expense)
        session.commit()
        return {"ok": True}


@router.get("/accounting/summary")
def accounting_summary():
    settings = get_settings()
    fee_rate = settings.resale_fee_rate
    with get_session() as session:
        items = session.exec(select(StockItem)).all()
        sales = session.exec(select(Sale)).all()
        expenses = session.exec(select(Expense)).all()

    item_map = {i.id: i for i in items}

    invested_total = sum(i.purchase_price * i.quantity for i in items)
    revenue_gross = sum(s.unit_price * s.quantity for s in sales)
    fees_total = sum(s.fees for s in sales)
    cost_of_sold = sum(
        s.quantity * item_map[s.item_id].purchase_price
        for s in sales
        if s.item_id in item_map
    )
    profit_realized = revenue_gross - fees_total - cost_of_sold
    expenses_total = sum(e.amount for e in expenses)
    profit_net = profit_realized - expenses_total

    stock_value = sum(i.remaining * i.purchase_price for i in items)
    stock_potential_net = sum(
        i.remaining * (i.estimated_resale * (1 - fee_rate) - i.purchase_price)
        for i in items
        if i.estimated_resale is not None
    )

    # Rotation moyenne : jours entre achat et vente
    days_to_sell = [
        (s.sale_date - item_map[s.item_id].purchase_date).days
        for s in sales
        if s.item_id in item_map
    ]
    avg_days_to_sell = round(sum(days_to_sell) / len(days_to_sell), 1) if days_to_sell else None

    # Top produits par bénéfice cumulé
    by_item: dict[int, dict[str, Any]] = {}
    for s in sales:
        cost = s.quantity * item_map[s.item_id].purchase_price if s.item_id in item_map else 0.0
        entry = by_item.setdefault(
            s.item_id, {"name": s.item_name, "profit": 0.0, "salesCount": 0}
        )
        entry["profit"] += s.unit_price * s.quantity - s.fees - cost
        entry["salesCount"] += 1
    top_products = sorted(by_item.values(), key=lambda x: x["profit"], reverse=True)[:5]
    for entry in top_products:
        entry["profit"] = round(entry["profit"], 2)

    monthly: dict[str, dict[str, float]] = defaultdict(
        lambda: {
            "revenue": 0.0,
            "fees": 0.0,
            "cost": 0.0,
            "profit": 0.0,
            "expenses": 0.0,
            "profitNet": 0.0,
            "salesCount": 0,
        }
    )
    for s in sales:
        month = s.sale_date.strftime("%Y-%m")
        cost = s.quantity * item_map[s.item_id].purchase_price if s.item_id in item_map else 0.0
        revenue = s.unit_price * s.quantity
        m = monthly[month]
        m["revenue"] += revenue
        m["fees"] += s.fees
        m["cost"] += cost
        m["profit"] += revenue - s.fees - cost
        m["salesCount"] += 1
    for e in expenses:
        month = e.expense_date.strftime("%Y-%m")
        monthly[month]["expenses"] += e.amount
    for m in monthly.values():
        m["profitNet"] = m["profit"] - m["expenses"]

    # ROI par categorie (F3) : profit realise + cout des ventes par categorie de
    # l'objet vendu, plus la valeur du stock encore detenu par categorie.
    by_cat: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"profit": 0.0, "cost": 0.0, "salesCount": 0, "stockValue": 0.0}
    )
    for s in sales:
        item = item_map.get(s.item_id)
        cat = (item.category or "Sans catégorie") if item else "Sans catégorie"
        cost = s.quantity * item.purchase_price if item else 0.0
        c = by_cat[cat]
        c["profit"] += s.unit_price * s.quantity - s.fees - cost
        c["cost"] += cost
        c["salesCount"] += 1
    for i in items:
        if i.remaining > 0:
            by_cat[i.category or "Sans catégorie"]["stockValue"] += i.remaining * i.purchase_price
    by_category = [
        {
            "category": cat,
            "profit": round(v["profit"], 2),
            "salesCount": v["salesCount"],
            "stockValue": round(v["stockValue"], 2),
            "roiPct": round(v["profit"] / v["cost"] * 100, 1) if v["cost"] > 0 else None,
        }
        for cat, v in sorted(by_cat.items(), key=lambda kv: kv[1]["profit"], reverse=True)
    ]

    return {
        "investedTotal": round(invested_total, 2),
        "revenueGross": round(revenue_gross, 2),
        "feesTotal": round(fees_total, 2),
        "costOfSold": round(cost_of_sold, 2),
        "profitRealized": round(profit_realized, 2),
        "expensesTotal": round(expenses_total, 2),
        "profitNet": round(profit_net, 2),
        "roiPct": round(profit_realized / cost_of_sold * 100, 1) if cost_of_sold > 0 else None,
        "avgDaysToSell": avg_days_to_sell,
        "topProducts": top_products,
        "stockValue": round(stock_value, 2),
        "stockPotentialNet": round(stock_potential_net, 2),
        "itemsInStock": sum(i.remaining for i in items),
        "itemsTotal": len(items),
        "salesCount": len(sales),
        "feeRate": fee_rate,
        "byCategory": by_category,
        "monthly": [
            {"month": month, **{k: round(v, 2) for k, v in data.items()}}
            for month, data in sorted(monthly.items(), reverse=True)
        ],
    }
