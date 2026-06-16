-- Schema addendum: Erector tiers, dashboard mode, handoff engine, Ultimate intelligence.
-- Forward-only: ADD columns/tables only — no drops, renames, or edits to existing migrations.

-- Section 1: users table additions
ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_mode TEXT NOT NULL DEFAULT 'limited';
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS erector_tier TEXT;
--> statement-breakpoint

-- Section 2: blueprints table additions (erector_validation_id may already exist from prior migration)
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS erector_validation_id UUID;
--> statement-breakpoint
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS erector_intake_session_id UUID;
--> statement-breakpoint
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS blueprint_source TEXT NOT NULL DEFAULT 'onboarding';
--> statement-breakpoint

-- Section 3: erector_free_validations
CREATE TABLE IF NOT EXISTS erector_free_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  ip_address TEXT,
  industry TEXT NOT NULL,
  location TEXT NOT NULL,
  budget_range TEXT NOT NULL,
  timeline TEXT NOT NULL,
  additional_context TEXT,
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_score INTEGER,
  verdict TEXT,
  converted_to TEXT,
  converted_at TIMESTAMPTZ,
  handoff_token_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_erector_free_fingerprint ON erector_free_validations(fingerprint);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_erector_free_created_at ON erector_free_validations(created_at);
--> statement-breakpoint

-- Section 4: erector_paid_validations
CREATE TABLE IF NOT EXISTS erector_paid_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  intake_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  project_name TEXT,
  verdict TEXT,
  selected_path TEXT,
  goal_structured JSONB DEFAULT '{}'::jsonb,
  purpose_structured JSONB DEFAULT '{}'::jsonb,
  industry TEXT,
  location TEXT,
  business_type TEXT,
  revenue_model TEXT,
  budget_range TEXT,
  hours_per_week INTEGER,
  team_size INTEGER,
  skills_present TEXT[] DEFAULT ARRAY[]::text[],
  skills_missing TEXT[] DEFAULT ARRAY[]::text[],
  timeline_launch TEXT,
  timeline_customers TEXT,
  timeline_final TEXT,
  success_30_days TEXT,
  success_90_days TEXT,
  success_12_months TEXT,
  risk_flags TEXT[] DEFAULT ARRAY[]::text[],
  policy_rules TEXT[] DEFAULT ARRAY[]::text[],
  policy_dont TEXT[] DEFAULT ARRAY[]::text[],
  winning_conditions TEXT[] DEFAULT ARRAY[]::text[],
  failure_conditions TEXT[] DEFAULT ARRAY[]::text[],
  validation_score INTEGER,
  probability_proceed INTEGER,
  archetype TEXT,
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  blueprint_created BOOLEAN DEFAULT false,
  blueprint_id UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_erector_paid_validations_user_id ON erector_paid_validations(user_id);
--> statement-breakpoint

-- Section 5: erector_intake_sessions
CREATE TABLE IF NOT EXISTS erector_intake_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  current_section INTEGER NOT NULL DEFAULT 1,
  sections_completed INTEGER[] DEFAULT ARRAY[]::integer[],
  section_1_data JSONB DEFAULT '{}'::jsonb,
  section_2_data JSONB DEFAULT '{}'::jsonb,
  section_3_data JSONB DEFAULT '{}'::jsonb,
  section_4_data JSONB DEFAULT '{}'::jsonb,
  section_5_data JSONB DEFAULT '{}'::jsonb,
  section_6_data JSONB DEFAULT '{}'::jsonb,
  section_7_data JSONB DEFAULT '{}'::jsonb,
  section_8_data JSONB DEFAULT '{}'::jsonb,
  prefilled_from_handoff BOOLEAN DEFAULT false,
  handoff_token_id UUID,
  status TEXT NOT NULL DEFAULT 'in_progress',
  validation_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  last_saved_at TIMESTAMPTZ DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_erector_intake_sessions_user_id ON erector_intake_sessions(user_id);
--> statement-breakpoint

-- Section 6: handoff_tokens
CREATE TABLE IF NOT EXISTS handoff_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tier TEXT NOT NULL,
  target_tier TEXT NOT NULL,
  source_validation_id UUID,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL,
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  consumed BOOLEAN NOT NULL DEFAULT false,
  consumed_at TIMESTAMPTZ,
  consumed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_handoff_tokens_token_hash ON handoff_tokens(token_hash);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_handoff_tokens_expires_at ON handoff_tokens(expires_at);
--> statement-breakpoint

-- Section 7: simulation_results (Ultimate only)
CREATE TABLE IF NOT EXISTS simulation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  validation_id UUID NOT NULL,
  blueprint_id UUID,
  archetype TEXT NOT NULL,
  scenario_best_description TEXT,
  scenario_best_probability INTEGER,
  scenario_best_timeline_adj TEXT,
  scenario_best_risks TEXT[] DEFAULT ARRAY[]::text[],
  scenario_best_triggers TEXT[] DEFAULT ARRAY[]::text[],
  scenario_base_description TEXT,
  scenario_base_probability INTEGER,
  scenario_base_timeline_adj TEXT,
  scenario_base_risks TEXT[] DEFAULT ARRAY[]::text[],
  scenario_base_triggers TEXT[] DEFAULT ARRAY[]::text[],
  scenario_downside_description TEXT,
  scenario_downside_probability INTEGER,
  scenario_downside_timeline_adj TEXT,
  scenario_downside_risks TEXT[] DEFAULT ARRAY[]::text[],
  scenario_downside_triggers TEXT[] DEFAULT ARRAY[]::text[],
  framework_verdicts_json JSONB DEFAULT '{}'::jsonb,
  veto_active BOOLEAN DEFAULT false,
  veto_frameworks TEXT[] DEFAULT ARRAY[]::text[],
  veto_reasons TEXT[] DEFAULT ARRAY[]::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_simulation_results_user_id ON simulation_results(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_simulation_results_validation_id ON simulation_results(validation_id);
--> statement-breakpoint

-- Section 8: goal_intelligence (Ultimate only)
CREATE TABLE IF NOT EXISTS goal_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  current_goal TEXT NOT NULL,
  expected_goal TEXT,
  future_goal TEXT,
  divergence_detected BOOLEAN DEFAULT false,
  divergence_score INTEGER DEFAULT 0,
  divergence_reason TEXT,
  alert_active BOOLEAN DEFAULT false,
  alert_type TEXT,
  alert_message TEXT,
  last_evaluated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_goal_intelligence_user_id ON goal_intelligence(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_goal_intelligence_blueprint_id ON goal_intelligence(blueprint_id);
--> statement-breakpoint

-- Section 9: prediction_log (Ultimate only — distinct from legacy prediction_logs)
CREATE TABLE IF NOT EXISTS prediction_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL,
  customer_label TEXT NOT NULL,
  trigger_condition TEXT NOT NULL,
  predicted_days_until_crisis INTEGER,
  confidence INTEGER DEFAULT 0,
  action_generated BOOLEAN DEFAULT false,
  action_order_id UUID,
  status TEXT NOT NULL DEFAULT 'active',
  resolved_at TIMESTAMPTZ,
  resolution_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_prediction_log_user_id ON prediction_log(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_prediction_log_blueprint_id ON prediction_log(blueprint_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_prediction_log_status ON prediction_log(status);
