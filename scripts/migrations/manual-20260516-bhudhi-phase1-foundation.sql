-- Bhudhi Phase 1: World Model, Agent Registry, Contradictions, Predictions, Morning Reports

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS civilization_context jsonb,
  ADD COLUMN IF NOT EXISTS communication_profile jsonb;

ALTER TABLE bhudhi_logs
  ADD COLUMN IF NOT EXISTS confidence_tier text,
  ADD COLUMN IF NOT EXISTS fallback_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS output_hash text,
  ADD COLUMN IF NOT EXISTS world_state_version integer,
  ADD COLUMN IF NOT EXISTS validation_fail_reason text;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pre_generated';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS world_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  user_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  goal_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  signal_trajectory jsonb NOT NULL DEFAULT '{}'::jsonb,
  motivation_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  market_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  identity_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  environmental_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  state_version integer NOT NULL DEFAULT 0,
  last_drift_calculation timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_world_models_user_id ON world_models(user_id);

CREATE TABLE IF NOT EXISTS agent_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE',
  activation_phase text NOT NULL DEFAULT 'P1',
  trigger_types text[] NOT NULL DEFAULT '{}',
  output_contract text NOT NULL,
  last_activated timestamptz,
  total_activations integer NOT NULL DEFAULT 0,
  average_latency_ms double precision,
  quality_score double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prediction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id uuid REFERENCES blueprints(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  prediction_type text NOT NULL,
  prediction jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_level double precision NOT NULL DEFAULT 0.5,
  confidence_tier text NOT NULL DEFAULT 'MEDIUM',
  predicted_outcome jsonb,
  actual_outcome jsonb,
  accuracy_score double precision,
  verification_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prediction_logs_user_id ON prediction_logs(user_id);

CREATE TABLE IF NOT EXISTS contradiction_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  contradiction_type text NOT NULL,
  description text NOT NULL,
  elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contradiction_records_blueprint_id ON contradiction_records(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_contradiction_records_user_id ON contradiction_records(user_id);

CREATE TABLE IF NOT EXISTS morning_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id uuid REFERENCES blueprints(id) ON DELETE CASCADE,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  eis_section jsonb,
  signal_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_task_preview jsonb,
  report_body jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_morning_reports_user_id ON morning_reports(user_id);

INSERT INTO agent_registry (agent_name, status, activation_phase, trigger_types, output_contract)
VALUES
  ('STRATEGY', 'ACTIVE', 'P1', ARRAY['USER_GOAL_TRIGGER','DOMAIN_RESOLUTION','BLUEPRINT_INTERPRETATION'], 'goal.structure.v1'),
  ('BLUEPRINT', 'ACTIVE', 'P1', ARRAY['BLUEPRINT_GENERATION','BLUEPRINT_INTERPRETATION','OVERNIGHT_CYCLE'], 'blueprint.generate.v1'),
  ('TASK_GENERATION', 'ACTIVE', 'P1', ARRAY['TASK_DRAFTING','RECOVERY_COPY','ACADEMY_SUPPORT'], 'task.draft.v1'),
  ('BEHAVIORAL', 'ACTIVE', 'P1', ARRAY['FEEDBACK_CLASSIFICATION','OVERNIGHT_CYCLE','WORLD_STATE_UPDATE'], 'feedback.classify_blocker.v1'),
  ('CRITIC', 'ACTIVE', 'P1', ARRAY['*'], 'state.explain.v1'),
  ('SELF_IMPROVEMENT', 'ACTIVE', 'P1', ARRAY['SELF_IMPROVEMENT_CYCLE','COMPRESSION_CYCLE'], 'state.explain.v1'),
  ('EIS', 'ACTIVE', 'P1', ARRAY['OVERNIGHT_CYCLE'], 'reality_intelligence'),
  ('KNOWLEDGE', 'ACTIVE', 'P1', ARRAY['KNOWLEDGE_INJECTION','ACADEMY_SUPPORT'], 'academy_instruction'),
  ('CONDITION', 'ACTIVE', 'P1', ARRAY['TASK_DRAFTING','STATE_EXPLANATION'], 'state.explain.v1'),
  ('PSYCHOLOGY', 'DORMANT', 'P2', ARRAY[]::text[], 'state.explain.v1'),
  ('SIMULATION', 'DORMANT', 'P2', ARRAY[]::text[], 'state.explain.v1'),
  ('ECONOMIC', 'DORMANT', 'P3', ARRAY[]::text[], 'state.explain.v1')
ON CONFLICT (agent_name) DO NOTHING;

ALTER TABLE bhudhi_memory
  ADD COLUMN IF NOT EXISTS is_compressed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_event_id text;
