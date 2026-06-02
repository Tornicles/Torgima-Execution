-- Phase 7 — same as migrations/0037_phase7_schema_verification.sql

CREATE TABLE IF NOT EXISTS migration_ledger (
  script_name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE 'partial';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE 'needs_clarification';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE 'pending_review';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE 'queued';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS system_locked BOOLEAN NOT NULL DEFAULT false;

UPDATE blueprints
SET paused = true
WHERE paused_at IS NOT NULL AND paused = false;

UPDATE blueprints
SET system_locked = true
WHERE COALESCE((metadata->>'system_locked')::boolean, false) = true
  AND system_locked = false;

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS effort_score INTEGER;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS feedback_idempotency_key_idx
  ON feedback (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

INSERT INTO migration_ledger (script_name, applied_at)
VALUES ('engines_doc10_28_phase7.sql', now())
ON CONFLICT (script_name) DO NOTHING;
