-- Non-destructive compatibility patch for onboarding validation.
-- Adds missing tables/columns only; does not drop, rename, or change existing data types.

ALTER TABLE users ADD COLUMN IF NOT EXISTS active_blueprint_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_unique ON sessions(token) WHERE token IS NOT NULL;

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_user_id ON magic_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email ON magic_link_tokens(email);

ALTER TABLE validations ADD COLUMN IF NOT EXISTS raw_goal TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS timeframe TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS timeframe_days INTEGER;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS current_context TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS success_signal TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS location_context TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS reality_context TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_blueprint_tier user_tier DEFAULT 'starter';
ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_blueprint_mode user_mode DEFAULT 'individual';
ALTER TABLE validations ADD COLUMN IF NOT EXISTS overall_score INTEGER;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS scores JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS key_insights JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS potential_risks JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS path_options JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS recommendation TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS intelligence JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS current_context TEXT;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS success_signal TEXT;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS known_blockers TEXT;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS plan_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phase_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS command_context JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS knowledge_links JSONB;
CREATE INDEX IF NOT EXISTS idx_orders_plan_id ON orders(plan_id);
CREATE INDEX IF NOT EXISTS idx_orders_phase_id ON orders(phase_id);
CREATE INDEX IF NOT EXISTS idx_orders_project_id ON orders(project_id);

ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS consistency DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS velocity DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS streak_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS window_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS data_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS state_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS condition_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  condition condition NOT NULL DEFAULT 'nothingness',
  previous_condition condition,
  escalation_level INTEGER NOT NULL DEFAULT 0,
  duration_days DOUBLE PRECISION NOT NULL DEFAULT 0,
  recovery_required BOOLEAN NOT NULL DEFAULT false,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  state_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_condition_records_blueprint_id ON condition_records(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_condition_records_blueprint_current ON condition_records(blueprint_id, is_current);

ALTER TABLE enforcement_packages ADD COLUMN IF NOT EXISTS recovery_required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE enforcement_packages ADD COLUMN IF NOT EXISTS progression_allowed BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE enforcement_packages ADD COLUMN IF NOT EXISTS state_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE state_memory ADD COLUMN IF NOT EXISTS state_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE state_memory ADD COLUMN IF NOT EXISTS payload JSONB;

ALTER TABLE events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE capability_profiles ADD COLUMN IF NOT EXISTS current_level TEXT NOT NULL DEFAULT 'beginner';
ALTER TABLE capability_profiles ADD COLUMN IF NOT EXISTS streak_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE capability_profiles ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE capability_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS task_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  order_id UUID,
  generation_mode TEXT NOT NULL,
  generation_trigger TEXT,
  task_type TEXT,
  difficulty TEXT,
  bhudhi_used BOOLEAN NOT NULL DEFAULT false,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  result TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_generation_logs_blueprint_id ON task_generation_logs(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_task_generation_logs_user_id ON task_generation_logs(user_id);
