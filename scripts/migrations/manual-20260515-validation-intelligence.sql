-- Phase 3: Validation intelligence hardening
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
