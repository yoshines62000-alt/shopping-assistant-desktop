"""Gestion des favoris : offres mises de côté, rangées dans des listes
(étiquettes, plusieurs par favori), avec annotations perso (note, prix cible).

Backend persistant -> inclus dans la sauvegarde, conservé entre machines.
"""

import json
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import delete, select

from ..db import get_session
from ..models import Favorite, FavoriteList, FavoriteTag, utcnow_naive

router = APIRouter()

# Sites dont on sait re-scraper le prix d'une fiche (cf. background.fetch_current_price).
REFRESHABLE = ("amazon.", "ebay.")


# --------------------------------------------------------------------------- #
# Sérialisation
# --------------------------------------------------------------------------- #
def _list_to_camel(lst: FavoriteList, count: int = 0) -> dict[str, Any]:
    return {
        "id": lst.id,
        "name": lst.name,
        "color": lst.color or None,
        "sortOrder": lst.sort_order,
        "count": count,
    }


def _fav_to_camel(f: Favorite, list_ids: list[int]) -> dict[str, Any]:
    return {
        "id": f.id,
        "productId": f.product_id,
        "name": f.name,
        "price": f.price,
        "siteDomain": f.site_domain,
        "sourceUrl": f.source_url,
        "imageUrl": f.image_url or None,
        "seller": f.seller or None,
        "rating": f.rating,
        "reviewCount": f.review_count,
        "deliveryDays": f.delivery_days,
        "notes": f.notes,
        "targetPrice": f.target_price,
        "previousPrice": f.previous_price,
        "priceCheckedAt": f.price_checked_at.isoformat() if f.price_checked_at else None,
        "priceHistory": _history_prices(f),
        "listIds": list_ids,
        "addedAt": f.added_at.isoformat(),
    }


def _history_prices(f: Favorite) -> list[float]:
    """Liste des prix de l'historique (pour un mini-graphe), le plus ancien d'abord."""
    try:
        return [float(p["price"]) for p in json.loads(f.price_history or "[]") if "price" in p]
    except (ValueError, TypeError):
        return []


# --------------------------------------------------------------------------- #
# Listes
# --------------------------------------------------------------------------- #
class ListPayload(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: Optional[str] = Field(default=None, max_length=20)


@router.get("/favorites/lists")
def list_lists() -> dict[str, Any]:
    with get_session() as session:
        lists = session.exec(
            select(FavoriteList).order_by(FavoriteList.sort_order, FavoriteList.created_at)
        ).all()
        counts: dict[int, int] = {}
        for row in session.exec(select(FavoriteTag.list_id)).all():
            counts[row] = counts.get(row, 0) + 1
    return {"lists": [_list_to_camel(lst, counts.get(lst.id, 0)) for lst in lists]}


@router.post("/favorites/lists")
def create_list(payload: ListPayload) -> dict[str, Any]:
    with get_session() as session:
        nb = len(session.exec(select(FavoriteList.id)).all())
        lst = FavoriteList(name=payload.name.strip(), color=(payload.color or "").strip(), sort_order=nb)
        session.add(lst)
        session.commit()
        session.refresh(lst)
        return _list_to_camel(lst)


@router.patch("/favorites/lists/{list_id}")
def update_list(list_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    with get_session() as session:
        lst = session.get(FavoriteList, list_id)
        if not lst:
            raise HTTPException(status_code=404, detail="Liste introuvable")
        if "name" in payload and str(payload["name"]).strip():
            lst.name = str(payload["name"]).strip()[:100]
        if "color" in payload:
            lst.color = str(payload["color"] or "").strip()[:20]
        if "sortOrder" in payload:
            try:
                lst.sort_order = int(payload["sortOrder"])
            except (TypeError, ValueError):
                pass
        session.add(lst)
        session.commit()
        session.refresh(lst)
        return _list_to_camel(lst)


@router.delete("/favorites/lists/{list_id}")
def delete_list(list_id: int) -> dict[str, Any]:
    with get_session() as session:
        lst = session.get(FavoriteList, list_id)
        if lst:
            session.exec(delete(FavoriteTag).where(FavoriteTag.list_id == list_id))
            session.delete(lst)
            session.commit()
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Favoris
# --------------------------------------------------------------------------- #
class FavoritePayload(BaseModel):
    productId: str = Field(min_length=1, max_length=200)
    name: str = Field(default="", max_length=400)
    price: float = Field(default=0.0, ge=0)
    siteDomain: str = Field(default="", max_length=200)
    sourceUrl: str = Field(default="", max_length=1000)
    imageUrl: Optional[str] = Field(default=None, max_length=1000)
    seller: Optional[str] = Field(default=None, max_length=200)
    rating: Optional[float] = None
    reviewCount: Optional[int] = None
    deliveryDays: Optional[int] = None
    listIds: list[int] = Field(default_factory=list)


def _tags_for(session, favorite_ids: list[int]) -> dict[int, list[int]]:
    out: dict[int, list[int]] = {fid: [] for fid in favorite_ids}
    if not favorite_ids:
        return out
    for tag in session.exec(select(FavoriteTag).where(FavoriteTag.favorite_id.in_(favorite_ids))).all():
        out.setdefault(tag.favorite_id, []).append(tag.list_id)
    return out


def _set_tags(session, favorite_id: int, list_ids: list[int]) -> None:
    """Remplace les étiquettes d'un favori par `list_ids` (ignore les listes inexistantes)."""
    session.exec(delete(FavoriteTag).where(FavoriteTag.favorite_id == favorite_id))
    valid = {row for row in session.exec(select(FavoriteList.id)).all()}
    for lid in dict.fromkeys(list_ids):  # dédoublonne en gardant l'ordre
        if lid in valid:
            session.add(FavoriteTag(favorite_id=favorite_id, list_id=lid))


@router.get("/favorites")
def list_favorites(listId: Optional[int] = None) -> dict[str, Any]:
    with get_session() as session:
        if listId is not None:
            fav_ids = [t.favorite_id for t in session.exec(select(FavoriteTag).where(FavoriteTag.list_id == listId)).all()]
            favs = (
                session.exec(select(Favorite).where(Favorite.id.in_(fav_ids)).order_by(Favorite.added_at.desc())).all()
                if fav_ids
                else []
            )
        else:
            favs = session.exec(select(Favorite).order_by(Favorite.added_at.desc())).all()
        tags = _tags_for(session, [f.id for f in favs])
    return {"favorites": [_fav_to_camel(f, tags.get(f.id, [])) for f in favs]}


@router.post("/favorites")
def add_favorite(payload: FavoritePayload) -> dict[str, Any]:
    with get_session() as session:
        fav = session.exec(select(Favorite).where(Favorite.product_id == payload.productId)).first()
        if fav is None:
            fav = Favorite(
                product_id=payload.productId,
                name=payload.name[:400],
                price=payload.price,
                site_domain=payload.siteDomain[:200],
                source_url=payload.sourceUrl[:1000],
                image_url=(payload.imageUrl or "")[:1000],
                seller=(payload.seller or "")[:200],
                rating=payload.rating,
                review_count=payload.reviewCount,
                delivery_days=payload.deliveryDays,
            )
            session.add(fav)
            session.commit()
            session.refresh(fav)
        if payload.listIds:
            existing = {t.list_id for t in session.exec(select(FavoriteTag).where(FavoriteTag.favorite_id == fav.id)).all()}
            valid = {row for row in session.exec(select(FavoriteList.id)).all()}
            for lid in payload.listIds:
                if lid in valid and lid not in existing:
                    session.add(FavoriteTag(favorite_id=fav.id, list_id=lid))
            session.commit()
        tags = _tags_for(session, [fav.id])
        return _fav_to_camel(fav, tags.get(fav.id, []))


@router.patch("/favorites/{favorite_id}")
def update_favorite(favorite_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    with get_session() as session:
        fav = session.get(Favorite, favorite_id)
        if not fav:
            raise HTTPException(status_code=404, detail="Favori introuvable")
        if "notes" in payload:
            fav.notes = str(payload["notes"] or "")[:2000]
        if "targetPrice" in payload:
            tp = payload["targetPrice"]
            try:
                fav.target_price = float(tp) if tp not in (None, "") else None
            except (TypeError, ValueError):
                pass
        session.add(fav)
        session.commit()
        if "listIds" in payload and isinstance(payload["listIds"], list):
            _set_tags(session, favorite_id, [int(x) for x in payload["listIds"]])
            session.commit()
        session.refresh(fav)
        tags = _tags_for(session, [fav.id])
        return _fav_to_camel(fav, tags.get(fav.id, []))


@router.delete("/favorites/{favorite_id}")
def delete_favorite(favorite_id: int) -> dict[str, Any]:
    with get_session() as session:
        fav = session.get(Favorite, favorite_id)
        if fav:
            session.exec(delete(FavoriteTag).where(FavoriteTag.favorite_id == favorite_id))
            session.delete(fav)
            session.commit()
    return {"ok": True}


@router.delete("/favorites/by-product/{product_id}")
def delete_favorite_by_product(product_id: str) -> dict[str, Any]:
    """Pratique pour le cœur des résultats (on a l'id produit, pas l'id favori)."""
    with get_session() as session:
        fav = session.exec(select(Favorite).where(Favorite.product_id == product_id)).first()
        if fav:
            session.exec(delete(FavoriteTag).where(FavoriteTag.favorite_id == fav.id))
            session.delete(fav)
            session.commit()
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Rafraîchissement du prix (re-scrape la fiche -> écart vs cible à jour)
# --------------------------------------------------------------------------- #
def _can_refresh(fav: Favorite) -> bool:
    url = (fav.source_url or "").lower()
    return url.startswith("http") and any(s in url for s in REFRESHABLE)


def _refresh_one(session, fav: Favorite) -> dict[str, Any]:
    """Re-scrape le prix d'un favori et met à jour le suivi. Renvoie l'issue."""
    if not _can_refresh(fav):
        return {"id": fav.id, "status": "unsupported"}
    from ..background import fetch_current_price  # import paresseux (playwright lourd)

    new_price = fetch_current_price(fav.source_url)
    if new_price is None:
        return {"id": fav.id, "status": "unavailable"}
    old_price = fav.price
    now = utcnow_naive()
    # Historique : on amorce avec le prix d'origine au 1er refresh, puis on empile.
    try:
        hist = json.loads(fav.price_history or "[]")
        if not isinstance(hist, list):
            hist = []
    except ValueError:
        hist = []
    if not hist:
        hist.append({"price": old_price, "at": fav.added_at.isoformat()})
    hist.append({"price": float(new_price), "at": now.isoformat()})
    fav.price_history = json.dumps(hist[-30:])  # plafonné
    fav.previous_price = old_price
    fav.price = float(new_price)
    fav.price_checked_at = now
    session.add(fav)
    changed = abs(new_price - old_price) >= 0.01
    return {"id": fav.id, "status": "changed" if changed else "same", "oldPrice": old_price, "price": new_price}


@router.post("/favorites/{favorite_id}/refresh-price")
def refresh_favorite_price(favorite_id: int) -> dict[str, Any]:
    with get_session() as session:
        fav = session.get(Favorite, favorite_id)
        if not fav:
            raise HTTPException(status_code=404, detail="Favori introuvable")
        result = _refresh_one(session, fav)
        session.commit()
        session.refresh(fav)
        tags = _tags_for(session, [fav.id])
        return {**result, "favorite": _fav_to_camel(fav, tags.get(fav.id, []))}


@router.post("/favorites/refresh-prices")
def refresh_all_prices(limit: int = 15) -> dict[str, Any]:
    """Rafraîchit en lot les favoris dont on sait lire le prix (Amazon/eBay).
    Plafonné car chaque fiche coûte ~20 s de navigateur."""
    limit = max(1, min(limit, 40))
    results: list[dict[str, Any]] = []
    with get_session() as session:
        favs = session.exec(select(Favorite).order_by(Favorite.added_at.desc())).all()
        eligible = [f for f in favs if _can_refresh(f)][:limit]
        for fav in eligible:
            results.append(_refresh_one(session, fav))
        session.commit()
    changed = sum(1 for r in results if r["status"] == "changed")
    return {"checked": len(results), "changed": changed, "results": results}


class ImportPayload(BaseModel):
    favorites: list[FavoritePayload] = Field(default_factory=list)


@router.post("/favorites/import")
def import_favorites(payload: ImportPayload) -> dict[str, Any]:
    """Migration : importe en masse des favoris (ex. depuis le stockage local)."""
    imported = 0
    with get_session() as session:
        for item in payload.favorites:
            if session.exec(select(Favorite.id).where(Favorite.product_id == item.productId)).first():
                continue
            session.add(
                Favorite(
                    product_id=item.productId,
                    name=item.name[:400],
                    price=item.price,
                    site_domain=item.siteDomain[:200],
                    source_url=item.sourceUrl[:1000],
                    image_url=(item.imageUrl or "")[:1000],
                    seller=(item.seller or "")[:200],
                    rating=item.rating,
                    review_count=item.reviewCount,
                    delivery_days=item.deliveryDays,
                )
            )
            imported += 1
        session.commit()
    return {"imported": imported}
