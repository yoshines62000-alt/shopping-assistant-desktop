-- Migration 006 : suivi des retours (F10).
-- Idempotent Postgres (IF NOT EXISTS) et SQLite via l'enabler db.py.
ALTER TABLE sale ADD COLUMN IF NOT EXISTS returned BOOLEAN DEFAULT FALSE;
