-- Migration 002: tracking columns added after initial schema creation
ALTER TABLE stockitem ADD COLUMN IF NOT EXISTS previous_estimate FLOAT;
ALTER TABLE stockitem ADD COLUMN IF NOT EXISTS estimated_at TIMESTAMP;
ALTER TABLE alert ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMP;
