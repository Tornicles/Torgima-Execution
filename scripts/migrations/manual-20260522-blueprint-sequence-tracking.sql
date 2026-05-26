-- Blueprint sequence tracking (Starter / Growth / Ultimate)
-- Spec: SEQUENCE_SPECIFICATION_DATABASE.md

CREATE TABLE IF NOT EXISTS blueprint_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  current_sequence integer NOT NULL DEFAULT 1,
  current_sequence_name text NOT NULL DEFAULT 'GOAL',
  completed_sequences text[] NOT NULL DEFAULT ARRAY[]::text[],
  sequence_timestamps jsonb NOT NULL DEFAULT '{}'::jsonb,
  sequence_states jsonb NOT NULL DEFAULT '{}'::jsonb,
  sequence_validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sequence_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  total_sequences integer NOT NULL,
  completed_sequences integer NOT NULL DEFAULT 0,
  current_sequence_num integer NOT NULL DEFAULT 1,
  current_sequence_name text NOT NULL DEFAULT 'GOAL',
  flow_path text[] NOT NULL,
  sequence_duration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sequence_flows_current ON sequence_flows(current_sequence_name);

CREATE TABLE IF NOT EXISTS goal_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  goal_text text NOT NULL,
  outcome text, intent text, category text, direction text,
  success_metrics jsonb, expected_outputs text[], goal_score double precision,
  current_goal text, expected_goal text, future_goal text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purpose_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  purpose_text text NOT NULL,
  problem text, value text, change text, mission text,
  target_user text, desired_change text, execution_intent text,
  purpose_hierarchy jsonb, purpose_durability double precision,
  purpose_conflict text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS context_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  timeframe integer, location text, business_type text, delivery text,
  people_count integer, commitment text, budget double precision, limits text[],
  execution_pressure double precision, capability_expected text, workload_model jsonb,
  operating_rules jsonb, constraint_forecast jsonb, recovery_models jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validation_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  reality_result text, demand double precision, competition text, timing text,
  feasibility double precision, risk text,
  current_path text, adjusted_path text, alternative_path text, verdict text,
  risk_weight jsonb, path_comparison jsonb, feasibility_score double precision,
  validation_drift double precision, live_revalidation timestamptz, execution_forecast jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validation_result_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  selected_path text, path_memory jsonb,
  expected_scenario jsonb, failure_scenario jsonb, recovery_scenario jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blueprint_tier_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  selected_tier text NOT NULL, tier_rules jsonb, complexity_level integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policy_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  do_rules text[], dont_rules text[], winning_rules text[], failure_rules text[],
  operational_standard text[], task_influence jsonb, failure_patterns text[],
  adaptive_policies jsonb, conditional_policies jsonb, learning_policies jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS master_plan_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  mission text, success text, rules text[], deliverables text[],
  progress_governance jsonb, governance_type text, change_detection text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signal_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  signals text[], signal_history jsonb, signal_trend jsonb, signal_momentum jsonb,
  signal_forecast jsonb, signal_pressure jsonb, signal_probability jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mini_plan_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  mini_plans text[], cross_plan_prep jsonb, dependency_aware jsonb,
  can_compete boolean NOT NULL DEFAULT true,
  can_collaborate boolean NOT NULL DEFAULT true,
  can_reallocate boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS execution_structure_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  targets jsonb, target_control jsonb, target_tree jsonb, target_compounding jsonb, target_forecast jsonb,
  phases text[], phase_gates jsonb, phase_flex jsonb,
  project_structure jsonb, action_types text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_generation_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  current_orders jsonb, current_order_count integer,
  hidden_orders jsonb, hidden_queue_length integer,
  task_mutation jsonb, context_injection text[], future_orders jsonb,
  emergency_orders jsonb, opportunity_orders jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS execution_feedback_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  execution_output text, execution_result jsonb,
  execution_speed double precision, execution_behavior jsonb, execution_pattern text,
  completion text, score integer, reflection text,
  confidence double precision, interrogation jsonb,
  behavior_extracted jsonb, reality_learning jsonb, contradictions jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signal_condition_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  signal_progress double precision, signal_momentum double precision, signal_consistency double precision,
  signal_history jsonb, signal_trend text, signal_forecast text, signal_trajectory jsonb,
  current_condition text, task_control jsonb, difficulty_control jsonb, permission_control jsonb,
  can_reduce boolean, can_increase boolean, can_delay boolean, can_prioritize boolean,
  adaptation_triggered boolean NOT NULL DEFAULT false, adaptation_type text,
  correction_tasks text[], recovery_tasks text[], rebuild boolean, restructure boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prediction_scene_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  future_scene text, expected_risk jsonb, probability double precision,
  queue_mutation jsonb, next_orders jsonb, regeneration_trigger text,
  current_scene text, expected_scene text, ideal_scene text,
  how_to_move_forward text, projected_scene text, scene_probability double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
