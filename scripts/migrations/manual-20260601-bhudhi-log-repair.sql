-- Repair bhudhi_logs when table or columns are missing (BhudhiCore logUsage insert).

DO $$ BEGIN
  CREATE TYPE bhudhi_request_type AS ENUM (
    'goal_validation', 'blueprint_generation', 'policy_generation', 'task_generation',
    'task_regeneration', 'feedback_interpretation', 'feedback_interrogation',
    'condition_explanation', 'recovery_suggestion', 'academy_content',
    'knowledge_generation', 'behavior_analysis', 'dashboard_summary', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bhudhi_trigger_type AS ENUM (
    'task_generation', 'feedback_interpretation', 'feedback_interrogation',
    'goal_structuring', 'validation_analysis', 'condition_explanation', 'state_explanation',
    'blocker_classification', 'pattern_summary', 'evidence_summary', 'root_cause_candidates',
    'pivot_path_generation', 'academy_content', 'knowledge_update',
    'blueprint_generation', 'blueprint_interpretation', 'erector_analysis'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bhudhi_execution_context AS ENUM (
    'marketing', 'pr', 'strategy', 'execution', 'analysis'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS bhudhi_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id uuid,
  order_id uuid,
  request_type bhudhi_request_type NOT NULL,
  trigger_type bhudhi_trigger_type,
  response_type text,
  execution_context bhudhi_execution_context,
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_version text,
  model_used text,
  output_json jsonb,
  raw_response text,
  validation_status text,
  validation_notes text,
  output_schema_valid boolean NOT NULL DEFAULT true,
  authority_language_detected boolean NOT NULL DEFAULT false,
  latency_ms integer,
  token_count_in integer,
  token_count_out integer,
  confidence_tier text,
  fallback_used boolean NOT NULL DEFAULT false,
  output_hash text,
  world_state_version integer,
  validation_fail_reason text,
  web_search_calls integer,
  intelligence_grounded boolean,
  provider text DEFAULT 'claude',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS blueprint_id uuid;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS order_id uuid;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS request_type bhudhi_request_type;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS trigger_type bhudhi_trigger_type;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS response_type text;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS execution_context bhudhi_execution_context;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS input_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS prompt_version text;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS model_used text;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS output_json jsonb;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS raw_response text;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS validation_status text;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS validation_notes text;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS output_schema_valid boolean NOT NULL DEFAULT true;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS authority_language_detected boolean NOT NULL DEFAULT false;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS latency_ms integer;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS token_count_in integer;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS token_count_out integer;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS confidence_tier text;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS fallback_used boolean NOT NULL DEFAULT false;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS output_hash text;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS world_state_version integer;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS validation_fail_reason text;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS web_search_calls integer;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS intelligence_grounded boolean;
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS provider text DEFAULT 'claude';
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_bhudhi_logs_user_id ON bhudhi_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_logs_blueprint_id ON bhudhi_logs(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_logs_request_type ON bhudhi_logs(request_type);
