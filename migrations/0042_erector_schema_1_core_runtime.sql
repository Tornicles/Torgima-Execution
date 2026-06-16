-- ERECTOR SCHEMA 1 — Core Runtime Schema (foundation tables)
-- Forward-only: ADD columns/tables only — never modify DOC 02 base structure beyond listed columns.

-- PART 1.1 — users (columns may already exist from 0041)
ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_mode TEXT NOT NULL DEFAULT 'limited';
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS erector_tier TEXT;
--> statement-breakpoint

-- PART 1.2 — blueprints extensions
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS erector_state TEXT NOT NULL DEFAULT 'not_started';
--> statement-breakpoint
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS erector_simulation_id UUID;
--> statement-breakpoint
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS erector_archetype TEXT;
--> statement-breakpoint
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS erector_launch_contract_id UUID;
--> statement-breakpoint
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS blueprint_source TEXT NOT NULL DEFAULT 'onboarding';
--> statement-breakpoint

-- PART 2 — extend erector_intake_sessions (table from 0041)
ALTER TABLE erector_intake_sessions ADD COLUMN IF NOT EXISTS blueprint_id UUID REFERENCES blueprints(id);
--> statement-breakpoint
ALTER TABLE erector_intake_sessions ADD COLUMN IF NOT EXISTS normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE erector_intake_sessions ADD COLUMN IF NOT EXISTS missing_fields TEXT[] NOT NULL DEFAULT ARRAY[]::text[];
--> statement-breakpoint
ALTER TABLE erector_intake_sessions ADD COLUMN IF NOT EXISTS ambiguity_flags TEXT[] NOT NULL DEFAULT ARRAY[]::text[];
--> statement-breakpoint
ALTER TABLE erector_intake_sessions ADD COLUMN IF NOT EXISTS contradiction_flags TEXT[] NOT NULL DEFAULT ARRAY[]::text[];
--> statement-breakpoint
ALTER TABLE erector_intake_sessions ADD COLUMN IF NOT EXISTS validation_ready BOOLEAN NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE erector_intake_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_intake_sessions_status ON erector_intake_sessions(status);
--> statement-breakpoint

-- PART 2 — erector_user_reality_profiles
CREATE TABLE IF NOT EXISTS erector_user_reality_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intake_session_id UUID NOT NULL REFERENCES erector_intake_sessions(id),
  structured_goal TEXT NOT NULL,
  goal_measurable_outcome TEXT,
  structured_purpose JSONB NOT NULL DEFAULT '{}'::jsonb,
  industry TEXT,
  location TEXT,
  market_scope TEXT,
  operating_context TEXT,
  revenue_model TEXT,
  price_range TEXT,
  business_type TEXT,
  budget_range TEXT,
  budget_usd_estimate INTEGER,
  hours_per_week INTEGER,
  team_size INTEGER NOT NULL DEFAULT 1,
  skills_present TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  skills_missing TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  timeline_launch TEXT,
  timeline_customers TEXT,
  timeline_final TEXT,
  known_blockers TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  prior_attempts JSONB NOT NULL DEFAULT '[]'::jsonb,
  regulatory_flags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  success_30_days TEXT,
  success_90_days TEXT,
  success_12_months TEXT,
  payment_infrastructure TEXT,
  market_maturity TEXT,
  internet_reliability TEXT,
  profile_model_version TEXT NOT NULL DEFAULT 'v0.1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_reality_profiles_user ON erector_user_reality_profiles(user_id);
--> statement-breakpoint

-- PART 3 — verdict rules (seeded in 0043)
CREATE TABLE IF NOT EXISTS erector_verdict_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT NOT NULL UNIQUE,
  rule_name TEXT NOT NULL,
  rule_version TEXT NOT NULL DEFAULT 'v0.1',
  applies_to_engine TEXT NOT NULL,
  dimension TEXT NOT NULL,
  condition_description TEXT NOT NULL,
  threshold_type TEXT NOT NULL,
  threshold_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  tier_applicability TEXT[] NOT NULL DEFAULT ARRAY['starter','growth','ultimate']::text[],
  severity TEXT NOT NULL,
  verdict_effect TEXT NOT NULL,
  correction_required TEXT,
  revalidation_required BOOLEAN NOT NULL DEFAULT false,
  user_visible_reason TEXT NOT NULL,
  bypass_allowed BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_verdict_rules_engine ON erector_verdict_rules(applies_to_engine);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_verdict_rules_active ON erector_verdict_rules(active);
--> statement-breakpoint

-- PART 3 — validation runs
CREATE TABLE IF NOT EXISTS erector_validation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES blueprints(id),
  intake_session_id UUID REFERENCES erector_intake_sessions(id),
  reality_profile_id UUID REFERENCES erector_user_reality_profiles(id),
  run_number INTEGER NOT NULL DEFAULT 1,
  tier TEXT NOT NULL,
  market_viability_score INTEGER,
  demand_proof_score INTEGER,
  feasibility_score INTEGER,
  context_readiness_score INTEGER,
  contradiction_score INTEGER NOT NULL DEFAULT 0,
  evidence_quality_score INTEGER,
  confidence_score INTEGER,
  risk_score INTEGER,
  overall_validation_score INTEGER,
  demand_proof_class INTEGER NOT NULL DEFAULT 0,
  feasibility_rating TEXT,
  path_current JSONB NOT NULL DEFAULT '{}'::jsonb,
  path_adjusted JSONB NOT NULL DEFAULT '{}'::jsonb,
  path_alternative JSONB NOT NULL DEFAULT '{}'::jsonb,
  selected_path TEXT,
  verdict TEXT,
  verdict_confidence TEXT,
  rules_applied TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  hard_blockers TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  soft_warnings TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  risk_flags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  requires_correction BOOLEAN NOT NULL DEFAULT false,
  correction_fields TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  validation_model_version TEXT NOT NULL DEFAULT 'v0.1',
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_validation_runs_user ON erector_validation_runs(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_validation_runs_blueprint ON erector_validation_runs(blueprint_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_validation_runs_verdict ON erector_validation_runs(verdict);
--> statement-breakpoint

-- PART 3 — verdict decisions audit
CREATE TABLE IF NOT EXISTS erector_verdict_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id UUID NOT NULL REFERENCES erector_validation_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  rule_id TEXT NOT NULL REFERENCES erector_verdict_rules(rule_id),
  dimension TEXT NOT NULL,
  input_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  threshold_compared JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL,
  verdict_effect TEXT NOT NULL,
  fired BOOLEAN NOT NULL DEFAULT true,
  rule_version TEXT NOT NULL DEFAULT 'v0.1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_verdict_decisions_run ON erector_verdict_decisions(validation_run_id);
--> statement-breakpoint

-- PART 4 — archetype rule packs (seeded in 0043)
CREATE TABLE IF NOT EXISTS erector_archetype_rule_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype_id TEXT NOT NULL UNIQUE,
  archetype_name TEXT NOT NULL,
  archetype_version TEXT NOT NULL DEFAULT 'v0.1',
  core_risk TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  minimum_demand_proof_class INTEGER NOT NULL,
  demand_proof_description TEXT NOT NULL,
  proof_required TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  proof_description TEXT NOT NULL,
  common_failure_modes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  false_progress_patterns TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  capital_pressure TEXT NOT NULL,
  capital_range_usd_min INTEGER,
  capital_range_usd_max INTEGER,
  timeline_pressure TEXT NOT NULL,
  typical_months_to_traction INTEGER,
  validation_blockers TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  required_phase_gates JSONB NOT NULL DEFAULT '[]'::jsonb,
  correction_path_templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  starter_adjustments JSONB NOT NULL DEFAULT '{}'::jsonb,
  growth_adjustments JSONB NOT NULL DEFAULT '{}'::jsonb,
  ultimate_adjustments JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- PART 4 — threshold matrix (seeded in 0043)
CREATE TABLE IF NOT EXISTS erector_threshold_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_version TEXT NOT NULL DEFAULT 'v0.1',
  tier TEXT NOT NULL UNIQUE,
  proceed_min_score INTEGER NOT NULL,
  adjust_min_score INTEGER NOT NULL,
  pivot_max_score INTEGER NOT NULL,
  market_weight NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  demand_weight NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  feasibility_weight NUMERIC(3,2) NOT NULL DEFAULT 0.25,
  context_weight NUMERIC(3,2) NOT NULL DEFAULT 0.15,
  band_blocked_max INTEGER NOT NULL DEFAULT 20,
  band_weak_max INTEGER NOT NULL DEFAULT 40,
  band_unstable_max INTEGER NOT NULL DEFAULT 60,
  band_viable_max INTEGER NOT NULL DEFAULT 80,
  demand_proof_min_class INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- PART 4 — archetype classifications
CREATE TABLE IF NOT EXISTS erector_archetype_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  validation_run_id UUID REFERENCES erector_validation_runs(id),
  blueprint_id UUID REFERENCES blueprints(id),
  primary_archetype TEXT NOT NULL,
  secondary_archetype TEXT,
  tertiary_modifier TEXT,
  is_hybrid BOOLEAN NOT NULL DEFAULT false,
  hybrid_blend JSONB NOT NULL DEFAULT '{}'::jsonb,
  classification_confidence NUMERIC(3,2) NOT NULL DEFAULT 0.70,
  classification_reason TEXT NOT NULL,
  rule_pack_id TEXT NOT NULL,
  rule_pack_version TEXT NOT NULL DEFAULT 'v0.1',
  unit_economics JSONB NOT NULL DEFAULT '{}'::jsonb,
  classification_model_version TEXT NOT NULL DEFAULT 'v0.1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_archetype_class_user ON erector_archetype_classifications(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_archetype_class_blueprint ON erector_archetype_classifications(blueprint_id);
--> statement-breakpoint

-- PART 5 — evidence ledger
CREATE TABLE IF NOT EXISTS erector_evidence_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES blueprints(id),
  task_id UUID,
  academy_task_id UUID,
  outcome_id UUID,
  validation_run_id UUID REFERENCES erector_validation_runs(id),
  source_type TEXT NOT NULL,
  source_location TEXT,
  evidence_class TEXT NOT NULL,
  evidence_strength TEXT NOT NULL DEFAULT 'LOW',
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_summary TEXT,
  interpreted_by_bhudhi BOOLEAN NOT NULL DEFAULT false,
  bhudhi_summary TEXT,
  bhudhi_log_id UUID,
  signal_generated BOOLEAN NOT NULL DEFAULT false,
  signal_id UUID,
  validation_status TEXT NOT NULL DEFAULT 'pending',
  contradiction_status TEXT NOT NULL DEFAULT 'none',
  rejection_reason TEXT,
  linked_decision_ids TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  integrity_flags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  retention_policy TEXT NOT NULL DEFAULT 'standard',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_evidence_user ON erector_evidence_ledger(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_evidence_blueprint ON erector_evidence_ledger(blueprint_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_evidence_class ON erector_evidence_ledger(evidence_class);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_evidence_status ON erector_evidence_ledger(validation_status);
--> statement-breakpoint

-- PART 6 — erector signals
CREATE TABLE IF NOT EXISTS erector_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES blueprints(id),
  validation_run_id UUID REFERENCES erector_validation_runs(id),
  signal_type TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  confidence TEXT NOT NULL DEFAULT 'LOW',
  source_evidence_ids TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  source_execution_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculation_method TEXT NOT NULL,
  threshold_compared INTEGER,
  threshold_result TEXT,
  status TEXT NOT NULL DEFAULT 'current',
  consumed_by_decision_ids TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  signal_calculation_version TEXT NOT NULL DEFAULT 'v0.1',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_erector_signals_user ON erector_signals(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_erector_signals_blueprint ON erector_signals(blueprint_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_erector_signals_type ON erector_signals(signal_type);
--> statement-breakpoint

-- PART 7 — simulation runs
CREATE TABLE IF NOT EXISTS erector_simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  validation_run_id UUID NOT NULL REFERENCES erector_validation_runs(id),
  blueprint_id UUID REFERENCES blueprints(id),
  archetype_classification_id UUID REFERENCES erector_archetype_classifications(id),
  tier TEXT NOT NULL,
  primary_archetype TEXT NOT NULL,
  secondary_archetype TEXT,
  archetype_confidence NUMERIC(3,2) NOT NULL DEFAULT 0.70,
  probability_proceed INTEGER,
  probability_adjust INTEGER,
  probability_failure INTEGER,
  simulation_confidence TEXT NOT NULL DEFAULT 'LOW',
  best_case_description TEXT,
  best_case_probability INTEGER,
  best_case_timeline_adj TEXT,
  best_case_conditions TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  best_case_risks TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  best_case_warning_triggers TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  base_case_description TEXT,
  base_case_probability INTEGER,
  base_case_timeline_adj TEXT,
  base_case_risks TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  base_case_blockers TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  downside_description TEXT,
  downside_probability INTEGER,
  downside_timeline_adj TEXT,
  downside_failure_modes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  downside_correction_path TEXT,
  economic_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  civilization_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  framework_verdicts JSONB NOT NULL DEFAULT '[]'::jsonb,
  hard_vetoes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  soft_risks TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  veto_active BOOLEAN NOT NULL DEFAULT false,
  veto_frameworks TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  veto_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  recommended_path TEXT,
  verdict TEXT,
  simulation_model_version TEXT NOT NULL DEFAULT 'v0.1',
  archetype_rule_pack_version TEXT NOT NULL DEFAULT 'v0.1',
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_simulation_runs_user ON erector_simulation_runs(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_simulation_runs_blueprint ON erector_simulation_runs(blueprint_id);
--> statement-breakpoint

-- PART 7 — framework veto rules (seeded in 0043)
CREATE TABLE IF NOT EXISTS erector_framework_veto_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id TEXT NOT NULL,
  framework_name TEXT NOT NULL,
  rule_version TEXT NOT NULL DEFAULT 'v0.1',
  active_individual BOOLEAN NOT NULL DEFAULT false,
  active_team BOOLEAN NOT NULL DEFAULT false,
  condition_description TEXT NOT NULL,
  required_evidence TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  threshold JSONB NOT NULL DEFAULT '{}'::jsonb,
  veto_type TEXT NOT NULL,
  verdict_effect TEXT NOT NULL,
  correction_required TEXT NOT NULL,
  revalidation_required BOOLEAN NOT NULL DEFAULT true,
  user_visible_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_veto_rules_framework ON erector_framework_veto_rules(framework_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_veto_rules_framework_id ON erector_framework_veto_rules(framework_id);
--> statement-breakpoint

-- PART 8 — blueprint launch contracts
CREATE TABLE IF NOT EXISTS erector_blueprint_launch_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL REFERENCES blueprints(id),
  validation_run_id UUID NOT NULL REFERENCES erector_validation_runs(id),
  simulation_run_id UUID REFERENCES erector_simulation_runs(id),
  archetype_classification_id UUID REFERENCES erector_archetype_classifications(id),
  launch_permission TEXT NOT NULL,
  structured_goal TEXT NOT NULL,
  structured_purpose JSONB NOT NULL DEFAULT '{}'::jsonb,
  selected_path TEXT NOT NULL,
  economic_archetype TEXT NOT NULL,
  policy_rules TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  policy_dont TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  risk_flags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  hard_blockers TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  soft_blockers TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  winning_conditions TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  failure_conditions TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  required_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  academy_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_phase_gates JSONB NOT NULL DEFAULT '[]'::jsonb,
  simulation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  framework_verdicts JSONB NOT NULL DEFAULT '[]'::jsonb,
  tier TEXT NOT NULL,
  tier_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  audit_id UUID,
  contract_version TEXT NOT NULL DEFAULT 'v0.1',
  consumed BOOLEAN NOT NULL DEFAULT false,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_launch_contracts_blueprint ON erector_blueprint_launch_contracts(blueprint_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_launch_contracts_blueprint_unique ON erector_blueprint_launch_contracts(blueprint_id) WHERE consumed = false;
--> statement-breakpoint

-- PART 8 — correction paths
CREATE TABLE IF NOT EXISTS erector_correction_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES blueprints(id),
  validation_run_id UUID REFERENCES erector_validation_runs(id),
  source_engine TEXT NOT NULL,
  source_id TEXT NOT NULL,
  correction_type TEXT NOT NULL,
  blocked_action TEXT NOT NULL,
  reason TEXT NOT NULL,
  user_visible_reason TEXT NOT NULL,
  required_actions TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  required_evidence TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  revalidation_required BOOLEAN NOT NULL DEFAULT false,
  unblock_condition TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  audit_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_correction_paths_user ON erector_correction_paths(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_correction_paths_status ON erector_correction_paths(status);
