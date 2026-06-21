-- Migration 009 : suivi du prix des favoris (rafraîchissement).
-- Le favori garde le prix précédent + la date du dernier re-scrape pour afficher
-- l'évolution. Idempotent Postgres + SQLite (enabler db.py).
ALTER TABLE favorite ADD COLUMN IF NOT EXISTS previous_price FLOAT;
ALTER TABLE favorite ADD COLUMN IF NOT EXISTS price_checked_at TIMESTAMP;
