-- Migration 010 : historique de prix par favori (rempli à chaque rafraîchissement).
-- JSON de points [{price, at}]. Idempotent Postgres + SQLite (enabler db.py).
ALTER TABLE favorite ADD COLUMN IF NOT EXISTS price_history VARCHAR DEFAULT '[]';
