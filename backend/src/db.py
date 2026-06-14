import re
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text
from sqlmodel import SQLModel, Session, create_engine

from .config import get_settings

settings = get_settings()
# pool_pre_ping : teste la connexion avant usage -> évite les erreurs
# "server closed the connection" quand le conteneur Postgres a redémarré ou
# que la connexion est restée inactive. pool_recycle : recycle au bout de 30 min.
#
# App desktop : la base est SQLite (un fichier local, pas de serveur). Il faut
# check_same_thread=False car les handlers FastAPI et le threadpool de recherche
# accedent a la base depuis plusieurs threads.
_engine_kwargs = {"echo": False, "pool_pre_ping": True, "pool_recycle": 1800}
if settings.database_url.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
engine = create_engine(settings.database_url, **_engine_kwargs)

# Les fichiers SQL vivent dans src/db/migrations/ (et non src/migrations/) :
# sans ce chemin correct, _migration_files() renvoyait toujours [] et AUCUNE
# migration n'etait appliquee (les ALTER TABLE de suivi etaient ignores).
MIGRATIONS_DIR = Path(__file__).parent / "db" / "migrations"
MIGRATIONS_TABLE = "schema_migrations"


def _migration_files() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("*.sql")) if MIGRATIONS_DIR.exists() else []


def _ensure_migrations_table(conn) -> None:
    conn.execute(
        text(
            f"CREATE TABLE IF NOT EXISTS {MIGRATIONS_TABLE} "
            "(filename TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL)"
        )
    )


def _applied_migrations(conn) -> set[str]:
    rows = conn.execute(text(f"SELECT filename FROM {MIGRATIONS_TABLE}")).all()
    return {row[0] for row in rows}


def _migration_statements(path: Path) -> list[str]:
    sql = path.read_text(encoding="utf-8")
    # Retire les commentaires en ligne (--) avant de decouper sur ';' : sinon un
    # ';' present dans un commentaire serait pris pour un separateur d'instruction
    # et produirait un fragment "commentaires seuls" (erreur "empty query").
    sql = re.sub(r"--[^\n]*", "", sql)
    return [stmt.strip() for stmt in sql.split(";") if stmt.strip()]


def init_db():
    SQLModel.metadata.create_all(engine)
    with engine.begin() as conn:
        _ensure_migrations_table(conn)
    with engine.connect() as conn:
        applied = _applied_migrations(conn)
    for path in _migration_files():
        if path.name in applied:
            continue
        for stmt in _migration_statements(path):
            # Chaque statement dans sa propre transaction : certaines migrations
            # sont ecrites pour Postgres (ex: "ADD COLUMN IF NOT EXISTS", non
            # supporte par SQLite). Sur une base creee par create_all() les
            # colonnes existent deja -> on ignore l'echec sans contaminer les
            # statements suivants (ex: la creation d'index, elle, compatible).
            try:
                with engine.begin() as conn:
                    conn.execute(text(stmt))
            except Exception:
                pass
        with engine.begin() as conn:
            conn.execute(
                text(f"INSERT INTO {MIGRATIONS_TABLE} (filename, applied_at) VALUES (:filename, :applied_at)"),
                {
                    "filename": path.name,
                    "applied_at": datetime.now(timezone.utc).replace(tzinfo=None),
                },
            )


def get_session():
    return Session(engine)


def migrate():
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        conn.commit()
