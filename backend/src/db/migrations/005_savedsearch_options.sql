-- Migration 005 : options de surveillance (F18 fréquence, F21 baseline).
-- Idempotent Postgres (IF NOT EXISTS) et SQLite via l'enabler db.py.
ALTER TABLE savedsearch ADD COLUMN IF NOT EXISTS interval_minutes INTEGER DEFAULT 0;
ALTER TABLE savedsearch ADD COLUMN IF NOT EXISTS seeded BOOLEAN DEFAULT FALSE;
