-- Migration 004 : categorie d'objet (F3 - ROI par categorie).
-- Idempotent sur Postgres (IF NOT EXISTS) et sur SQLite via l'enabler db.py.
ALTER TABLE stockitem ADD COLUMN IF NOT EXISTS category VARCHAR DEFAULT '';
