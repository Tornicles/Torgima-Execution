-- BHUDHI Prompt 5 — execution sessions, knowledge packages, guarantee logs

CREATE TABLE IF NOT EXISTS execution_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  session_type text NOT NULL DEFAULT 'PRIMARY',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  tasks_generated integer NOT NULL DEFAULT 0,
  tasks_completed integer NOT NULL DEFAULT 0,
  feedback_cycles integer NOT NULL DEFAULT 0,
  signal_updates integer NOT NULL DEFAULT 0,
  session_health text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_execution_sessions_user ON execution_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_sessions_blueprint ON execution_sessions(blueprint_id);

CREATE TABLE IF NOT EXISTS knowledge_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  action_type text NOT NULL,
  phase text,
  sop text,
  benchmark text,
  tool_recommendations text[] NOT NULL DEFAULT ARRAY[]::text[],
  common_mistakes text[] NOT NULL DEFAULT ARRAY[]::text[],
  good_output_example text,
  execution_guidance text,
  eis_enriched boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_packages_domain_action ON knowledge_packages(domain, action_type);

CREATE TABLE IF NOT EXISTS continuous_task_guarantee_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id uuid REFERENCES blueprints(id) ON DELETE SET NULL,
  trigger_reason text NOT NULL,
  blocker_type text NOT NULL,
  task_type_generated text NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctg_logs_user ON continuous_task_guarantee_logs(user_id);

ALTER TABLE task_generation_log
  ADD COLUMN IF NOT EXISTS knowledge_injected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS knowledge_package_id uuid REFERENCES knowledge_packages(id),
  ADD COLUMN IF NOT EXISTS debate_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS generation_ms integer,
  ADD COLUMN IF NOT EXISTS control_rule_applied jsonb NOT NULL DEFAULT '{}'::jsonb;
