"""Sauvegarde / restauration de la base (F22).

Export/import **agnostique du SGBD** : on sérialise chaque table en JSON via
SQLModel, ce qui fonctionne aussi bien sur PostgreSQL (projet principal) que sur
SQLite (app desktop). Permet à l'utilisateur de télécharger une sauvegarde
complète et de la réimporter (migration de machine, sécurité des données).
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel
from sqlmodel import delete, select

from ..db import engine, get_session
from ..models import (
    Alert,
    AppSetting,
    DealHit,
    Expense,
    Favorite,
    FavoriteList,
    FavoriteTag,
    PriceHistory,
    ProductRef,
    Sale,
    SavedSearch,
    SiteReputation,
    StockItem,
)
from ..settings_store import SETTINGS_KEY

logger = logging.getLogger("routes.backup")
router = APIRouter()

# Réglages secrets : JAMAIS exportés en clair (sécurité). Caviardés à l'export ;
# à l'import, les valeurs vides sont remplacées par celles déjà en place (on ne
# perd donc pas ses identifiants en restaurant un backup).
SECRET_SETTING_KEYS = {"discordWebhookUrl", "telegramBotToken", "smtpPassword"}


def _redact_app_settings(rows: list[dict[str, Any]]) -> None:
    """Vide les clés secrètes dans les lignes appSettings (mutation en place)."""
    for row in rows:
        if row.get("key") != SETTINGS_KEY or not row.get("value"):
            continue
        try:
            value = json.loads(row["value"])
        except (TypeError, json.JSONDecodeError):
            continue
        for key in SECRET_SETTING_KEYS:
            if key in value:
                value[key] = ""
        row["value"] = json.dumps(value)

# Tables exportées/importées, dans un ordre respectant les dépendances
# (les parents avant les enfants pour l'import).
TABLES: list[tuple[str, type]] = [
    ("appSettings", AppSetting),
    ("productRefs", ProductRef),
    ("priceHistory", PriceHistory),
    ("alerts", Alert),
    ("expenses", Expense),
    ("stockItems", StockItem),
    ("sales", Sale),
    ("siteReputation", SiteReputation),
    ("savedSearches", SavedSearch),
    ("dealHits", DealHit),
    ("favoriteLists", FavoriteList),
    ("favorites", Favorite),
    ("favoriteTags", FavoriteTag),
]

BACKUP_VERSION = 1


@router.get("/backup/export")
def export_backup() -> dict[str, Any]:
    """Dump complet de la base au format JSON."""
    data: dict[str, Any] = {"version": BACKUP_VERSION, "tables": {}}
    with get_session() as session:
        for name, model in TABLES:
            rows = session.exec(select(model)).all()
            data["tables"][name] = [r.model_dump(mode="json") for r in rows]
    # Ne jamais exposer les secrets (webhook/token/mot de passe SMTP) en clair.
    _redact_app_settings(data["tables"].get("appSettings", []))
    counts = {k: len(v) for k, v in data["tables"].items()}
    logger.info("Export sauvegarde : %s", counts)
    data["counts"] = counts
    return data


class ImportPayload(BaseModel):
    version: int | None = None
    tables: dict[str, list[dict[str, Any]]] = {}
    replace: bool = True  # vide chaque table présente avant de réinsérer


@router.post("/backup/import")
def import_backup(payload: ImportPayload) -> dict[str, Any]:
    """Restaure une sauvegarde JSON. `replace=True` remplace les tables fournies."""
    restored: dict[str, int] = {}
    errors: list[str] = []

    # Secrets actuellement en place : on les réinjecte si l'import les a vides
    # (cas d'un backup caviardé) pour ne pas déconnecter les notifications.
    preserved: dict[str, str] = {}
    if "appSettings" in payload.tables:
        with get_session() as session:
            row = session.get(AppSetting, SETTINGS_KEY)
            if row:
                try:
                    cur = json.loads(row.value)
                    preserved = {k: cur.get(k, "") for k in SECRET_SETTING_KEYS}
                except (TypeError, json.JSONDecodeError):
                    pass
        for row in payload.tables["appSettings"]:
            if row.get("key") != SETTINGS_KEY or not row.get("value"):
                continue
            try:
                value = json.loads(row["value"])
            except (TypeError, json.JSONDecodeError):
                continue
            for key in SECRET_SETTING_KEYS:
                if not value.get(key) and preserved.get(key):
                    value[key] = preserved[key]
            row["value"] = json.dumps(value)

    with get_session() as session:
        # Import dans l'ordre des dépendances ; suppression en ordre inverse.
        if payload.replace:
            for name, model in reversed(TABLES):
                if name in payload.tables:
                    session.exec(delete(model))
            session.commit()

        for name, model in TABLES:
            rows = payload.tables.get(name)
            if not rows:
                continue
            ok = 0
            for row in rows:
                try:
                    session.add(model(**row))
                    ok += 1
                except Exception as exc:  # ligne corrompue : on continue
                    errors.append(f"{name}: {exc}")
            session.commit()
            restored[name] = ok
    logger.info("Import sauvegarde : %s (%d erreurs)", restored, len(errors))
    return {"restored": restored, "errors": errors[:20]}


# Nombre de snapshots conservés (rotation) pour la sauvegarde auto de l'app desktop.
SNAPSHOT_KEEP = 7


@router.post("/backup/snapshot")
def snapshot_db() -> dict[str, Any]:
    """Sauvegarde automatique du fichier SQLite (app desktop) via `VACUUM INTO`
    (copie cohérente même base ouverte), dans `<dossier db>/backups/`, avec
    rotation. Sans effet hors SQLite (le projet principal tourne sur Postgres) :
    déclenché par l'app Electron sur planning (démarrage + toutes les 24 h)."""
    if engine.dialect.name != "sqlite":
        return {"skipped": "not sqlite"}
    db_path = engine.url.database
    if not db_path or db_path == ":memory:":
        return {"skipped": "no file"}

    db_file = Path(db_path)
    backups = db_file.parent / "backups"
    backups.mkdir(parents=True, exist_ok=True)
    # Un snapshot par jour (rafraîchi à chaque déclenchement) -> 7 jours d'historique.
    target = backups / f"shopping-{datetime.now():%Y-%m-%d}.db"
    if target.exists():
        try:
            target.unlink()  # VACUUM INTO refuse d'écraser : on remplace celui du jour
        except OSError:
            pass

    # VACUUM INTO : chemin en littéral SQL (généré côté serveur, pas d'entrée
    # utilisateur) ; on double les apostrophes par sécurité.
    safe = str(target).replace("'", "''")
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(f"VACUUM INTO '{safe}'")
    except Exception as exc:
        logger.error("Snapshot SQLite échoué : %s", exc)
        return {"error": str(exc)}

    # Rotation : ne garder que les SNAPSHOT_KEEP plus récents.
    snaps = sorted(backups.glob("shopping-*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    removed = 0
    for old in snaps[SNAPSHOT_KEEP:]:
        try:
            old.unlink()
            removed += 1
        except OSError:
            pass
    logger.info("Snapshot SQLite -> %s (rotation: %d supprimés)", target.name, removed)
    return {"path": str(target), "kept": min(len(snaps), SNAPSHOT_KEEP), "removed": removed}
