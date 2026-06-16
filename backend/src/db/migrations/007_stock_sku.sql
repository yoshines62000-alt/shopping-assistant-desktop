-- Migration 007 : code de rangement SKU (F12).
-- Idempotent Postgres (IF NOT EXISTS) et SQLite via l'enabler db.py.
ALTER TABLE stockitem ADD COLUMN IF NOT EXISTS sku VARCHAR DEFAULT '';
