-- Migration 011 : alerte « passé sous la cible » pour les favoris.
-- Drapeau de déduplication (notifié une fois par franchissement). Idempotent
-- Postgres + SQLite (enabler db.py).
ALTER TABLE favorite ADD COLUMN IF NOT EXISTS notified_below_target BOOLEAN DEFAULT FALSE;
