-- historical migration filename only — not an active Railway dependency
-- Production repair: onboarding + validation schema drift (idempotent).
-- Applies columns from Drizzle 0001 + manual migrations that may not have run on older DBs.

-- ── Enums (safe create) ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE validation_kind AS ENUM (
    'legacy', 'intelligence', 'erector', 'readiness', 'path_selection', 'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE validation_readiness AS ENUM (
    'not_ready', 'partial', 'ready_proceed', 'ready_with_adjustment', 'blocked_pivot', 'blocked_reality'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE selected_path AS ENUM ('current', 'adjusted', 'alternative');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── validations: contract + kind (Drizzle 0001 — often missing when only manual-* ran) ──
ALTER TABLE validations ADD COLUMN IF NOT EXISTS contract_id uuid DEFAULT gen_random_uuid();
UPDATE validations SET contract_id = gen_random_uuid() WHERE contract_id IS NULL;

ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_kind validation_kind DEFAULT 'unknown';
UPDATE validations SET validation_kind = 'unknown'::validation_kind WHERE validation_kind IS NULL;

ALTER TABLE validations ADD COLUMN IF NOT EXISTS payload_version integer DEFAULT 1;
UPDATE validations SET payload_version = 1 WHERE payload_version IS NULL;

ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_path_type text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_path selected_path;

-- ── validations: intelligence / launch (manual phase3) ─────────────────────
ALTER TABLE validations ADD COLUMN IF NOT EXISTS tier user_tier;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS intelligence_payload jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS blueprint_contract jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS launch_blocked boolean DEFAULT false;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS adjusted_path_confirmed boolean DEFAULT false;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS readiness validation_readiness;

-- ── validations: onboarding intake (manual-20260519-validation-onboarding) ─
ALTER TABLE validations ADD COLUMN IF NOT EXISTS raw_goal text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS raw_purpose text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS timeframe text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS timeframe_days integer;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS domain text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS current_context text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS success_signal text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS location_context text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS reality_context text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_blueprint_tier user_tier DEFAULT 'starter';
ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_blueprint_mode user_mode DEFAULT 'individual';
ALTER TABLE validations ADD COLUMN IF NOT EXISTS overall_score integer;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS scores jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS path_options jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS intelligence jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS idempotency_key text;

-- ── validations: erector refinement + workspace (manual-20260526 / 20260527) ─
ALTER TABLE validations ADD COLUMN IF NOT EXISTS goal_options jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS goal_understanding jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_goal_option integer;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS goal_final text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS purpose_options jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS purpose_understanding jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_purpose_option integer;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS purpose_final text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS refinement_locked boolean DEFAULT false;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_feed jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_sections jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_final jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_workspace_version integer DEFAULT 0;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_original_snapshot jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS economic_type text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS is_finalized boolean DEFAULT false;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS handoff_package jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_version integer DEFAULT 1;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS erector_validation_stage text DEFAULT 'pending';
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_stage text DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_validations_contract_id ON validations(contract_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_validations_idempotency_key ON validations(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ── blueprints: onboarding insert + erector refinement ─────────────────────
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS raw_goal_input text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS raw_purpose_input text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS raw_purpose text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS goal_final text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS purpose_final text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS selected_blueprint_level text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS domain_hint text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS current_context text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS timeframe_days integer;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS commitment_level commitment_level;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS tier user_tier;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS mode user_mode DEFAULT 'individual';
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS validation_id uuid;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS erector_validation_id uuid;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS raw_goal text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS domain text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS success_signal text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS known_blockers text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS blueprint_config jsonb DEFAULT '{}'::jsonb;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
