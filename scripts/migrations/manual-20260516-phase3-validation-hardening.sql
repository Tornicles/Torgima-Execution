-- Phase 3: Validation engine hardening (idempotent — aligns with validations table model)
ALTER TABLE validations ADD COLUMN IF NOT EXISTS tier user_tier;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS intelligence_payload jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS blueprint_contract jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS launch_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS adjusted_path_confirmed boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE validation_readiness AS ENUM (
    'not_ready', 'partial', 'ready_proceed', 'ready_with_adjustment', 'blocked_pivot'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE validations ADD COLUMN IF NOT EXISTS readiness validation_readiness;

CREATE TABLE IF NOT EXISTS validation_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id uuid NOT NULL REFERENCES validations(id) ON DELETE CASCADE,
  stage text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validation_event_logs_validation_id ON validation_event_logs(validation_id);
CREATE INDEX IF NOT EXISTS idx_validation_event_logs_created_at ON validation_event_logs(created_at);
