-- BHUDHI PROMPT 35 — Unified Execution Runtime

CREATE TABLE IF NOT EXISTS bhudhi_unified_execution_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  execution_type text NOT NULL,
  execution_id text NOT NULL UNIQUE,
  action text NOT NULL DEFAULT '',
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  estimated_end timestamptz,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_unified_execution_contexts_blueprint_id
  ON bhudhi_unified_execution_contexts(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_unified_execution_contexts_execution_type
  ON bhudhi_unified_execution_contexts(execution_type);
CREATE INDEX IF NOT EXISTS idx_bhudhi_unified_execution_contexts_status
  ON bhudhi_unified_execution_contexts(status);

CREATE TABLE IF NOT EXISTS bhudhi_unified_execution_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id text NOT NULL,
  step_number integer NOT NULL,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  depends_on jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (execution_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_unified_execution_steps_execution_id
  ON bhudhi_unified_execution_steps(execution_id);

CREATE TABLE IF NOT EXISTS bhudhi_unified_execution_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id text NOT NULL,
  feedback_type text NOT NULL,
  message text NOT NULL,
  source text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_unified_execution_feedback_execution_id
  ON bhudhi_unified_execution_feedback(execution_id);

CREATE TABLE IF NOT EXISTS bhudhi_unified_execution_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id text NOT NULL UNIQUE,
  success boolean NOT NULL,
  outcome text NOT NULL,
  metrics_accuracy double precision NOT NULL DEFAULT 0,
  metrics_speed_ms integer NOT NULL DEFAULT 0,
  metrics_quality double precision NOT NULL DEFAULT 0,
  learnings jsonb NOT NULL DEFAULT '{}'::jsonb,
  improvements jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_unified_execution_results_success
  ON bhudhi_unified_execution_results(success);
