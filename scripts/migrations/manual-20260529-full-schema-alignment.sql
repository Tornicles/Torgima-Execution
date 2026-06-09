-- Full production schema alignment (idempotent).
-- Adds launch-chain and execution columns expected by Drizzle but often missing on Supabase.
-- Complements manual-20260603-railway-onboarding-validations-schema-repair.sql

DO $$ BEGIN
  CREATE TYPE blueprint_operational_state AS ENUM ('ACTIVE', 'STALLED', 'DEGRADED', 'RECOVERY', 'COLLAPSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── validations: paths + erector run ───────────────────────────────────────
ALTER TABLE validations ADD COLUMN IF NOT EXISTS path_current jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS path_adjusted jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS path_alternative jsonb;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS verdict text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS reality_score double precision;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS recommended_blueprint_level text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS location_country text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS commitment_level text;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS first_week_plan jsonb;

-- ── blueprints: launch + archetype metadata ─────────────────────────────────
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS blueprint_tier text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS primary_archetype_id uuid;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS reality_score double precision;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS industry_state text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS archetype_execution_mult double precision;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS archetype_timeframe_mult double precision;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS archetype_difficulty_adj double precision;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS intelligence_depth text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS selection_confirmed_at timestamptz;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS current_condition text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS operational_state blueprint_operational_state DEFAULT 'ACTIVE';
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS current_plan_id uuid;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS current_phase_id uuid;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS current_project_id uuid;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS current_action_id uuid;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS location jsonb;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS business_model text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS online_offline text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS budget double precision;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS current_resources jsonb;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS target_customers text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS target_profit double precision;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS selected_path text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS validation_verdict text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS validation_scores jsonb;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS validation_report jsonb;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS path_options jsonb;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS blueprint_options jsonb;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS state_version integer DEFAULT 0;

-- ── plans / phases / projects / actions (launch chain) ─────────────────────
ALTER TABLE plans ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE phases ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE phases ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE phases ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE phases ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;
ALTER TABLE phases ADD COLUMN IF NOT EXISTS progress_percent double precision DEFAULT 0;
ALTER TABLE phases ADD COLUMN IF NOT EXISTS unlock_criteria jsonb;
ALTER TABLE phases ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS progress_percent double precision DEFAULT 0;

ALTER TABLE actions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS action_type text;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS expected_output text;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── orders / feedback / signals ───────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS condition_at_generation text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS domain_at_generation text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS generation_reason text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS definition_of_done text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS command_context jsonb DEFAULT '{}'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS context_why text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS due_date timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS time_estimate_mins integer;

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS weighted_score double precision;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS friction_score double precision;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS confidence_score double precision;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS duration_minutes integer;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS proof_json jsonb;

ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS week_start timestamptz;
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS daily_score double precision DEFAULT 0;
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS completion_rate double precision;
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS momentum double precision;
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS condition text;

-- ── knowledge links ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid,
  user_id uuid,
  domain text,
  category text,
  action_type text,
  title text,
  content jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_knowledge_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  knowledge_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_order_knowledge ON order_knowledge_links(order_id, knowledge_id);
