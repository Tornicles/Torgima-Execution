-- FEEDBACK_SYSTEM_SPECIFICATION_NEW.md — structured feedback intelligence (additive only)

CREATE TABLE IF NOT EXISTS active_feedback_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  trigger_type TEXT NOT NULL DEFAULT 'app_open',
  daily_reality JSONB,
  reality_summary TEXT,
  task_states JSONB NOT NULL DEFAULT '[]'::jsonb,
  emotional_state JSONB NOT NULL DEFAULT '[]'::jsonb,
  friction_type JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_type JSONB NOT NULL DEFAULT '[]'::jsonb,
  reflection_signal TEXT,
  engine_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  signal_snapshot JSONB,
  execution_score DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  bhudhi_interpretation JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_active_feedback_sessions_blueprint_date
  ON active_feedback_sessions (blueprint_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_active_feedback_sessions_user_blueprint
  ON active_feedback_sessions (user_id, blueprint_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS task_state TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carry_over BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_feedback_at TIMESTAMPTZ;

ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS execution_score DOUBLE PRECISION;
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS feedback_confidence DOUBLE PRECISION;

ALTER TABLE bhudhi_signals ADD COLUMN IF NOT EXISTS execution_score DOUBLE PRECISION;
ALTER TABLE bhudhi_signals ADD COLUMN IF NOT EXISTS momentum DOUBLE PRECISION;
ALTER TABLE bhudhi_signals ADD COLUMN IF NOT EXISTS feedback_confidence DOUBLE PRECISION;
