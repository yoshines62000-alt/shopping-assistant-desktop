import re
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlmodel import SQLModel, Session, create_engine

from .config import get_settings

settings = get_settings()
# pool_pre_ping : teste la connexion avant usage -> évite les erreurs
# "server closed the connection" quand le conteneur Postgres a redémarré ou
# que la connexion est restée inactive. pool_recycle : recycle au bout de 30 min.
_engine_kwargs = {"echo": False, "pool_pre_ping": True, "pool_recycle": 1800}

_url = make_url(settings.database_url)
if _url.drivername.startswith("sqlite"):
    # App desktop : la base est un fichier SQLite (pas de serveur). Deux
    # adaptations indispensables :
    #  - check_same_thread=False : les handlers FastAPI et le threadpool de
    #    recherche accedent a la base depuis plusieurs threads.
    #  - creer le dossier parent : SQLite ne cree PAS l'arborescence et echoue
    #    avec "unable to open database file" si le dossier (ex: %APPDATA%\...)
    #    n'existe pas encore.
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
    if _url.database and _url.database != ":memory:":
        Path(_url.database).expanduser().parent.mkdir(parents=True, exist_ok=True)

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


# "ALTER TABLE t ADD COLUMN IF NOT EXISTS col <type/defaut...>" : syntaxe Postgres
# que SQLite ne comprend pas. Sur SQLite on emule l'idempotence via PRAGMA.
_ADD_COLUMN_IF_NOT_EXISTS = re.compile(
    r"ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(\w+)\s+(.+)",
    re.IGNORECASE | re.DOTALL,
)


def _sqlite_column_exists(conn, table: str, column: str) -> bool:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).all()
    return any(row[1] == column for row in rows)


def _apply_statement(stmt: str) -> None:
    """Execute un statement de migration, en traduisant pour SQLite le
    'ADD COLUMN IF NOT EXISTS' (non supporte) en ajout conditionnel via PRAGMA.

    Indispensable pour que les colonnes ajoutees apres coup (categorie, SKU,
    options de surveillance...) apparaissent aussi sur les bases SQLite DEJA
    creees -- sinon create_all() ne les ajoute qu'aux nouvelles bases."""
    is_sqlite = engine.dialect.name == "sqlite"
    match = _ADD_COLUMN_IF_NOT_EXISTS.match(stmt.strip())
    if is_sqlite and match:
        table, column, rest = match.group(1), match.group(2), match.group(3).strip()
        with engine.begin() as conn:
            if _sqlite_column_exists(conn, table, column):
                return  # deja presente (base recente creee par create_all)
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {rest}"))
        return
    # Postgres (ADD COLUMN IF NOT EXISTS natif) ou autres statements (index...).
    # try/except : sur une base creee par create_all les colonnes existent deja.
    try:
        with engine.begin() as conn:
            conn.execute(text(stmt))
    except Exception:
        pass


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
            # Chaque statement dans sa propre transaction. _apply_statement gere
            # le cas SQLite (ADD COLUMN IF NOT EXISTS -> ajout conditionnel via
            # PRAGMA) et ignore les echecs benins (colonne deja presente...).
            _apply_statement(stmt)
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
