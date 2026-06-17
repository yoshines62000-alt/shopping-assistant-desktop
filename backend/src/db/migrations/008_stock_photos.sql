-- Migration 008 : photos d'annonce par objet (F8).
-- JSON d'URLs data (vignettes base64). Idempotent Postgres + SQLite (enabler db.py).
ALTER TABLE stockitem ADD COLUMN IF NOT EXISTS photos VARCHAR DEFAULT '[]';
