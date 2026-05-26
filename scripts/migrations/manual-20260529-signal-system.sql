-- SIGNAL_SYSTEM_SPECIFICATION.md — 4 permanent Production/Operations/Growth/Scale signals

CREATE TABLE IF NOT EXISTS blueprint_framework_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  signal_key TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  previous_value DOUBLE PRECISION,
  momentum DOUBLE PRECISION NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'stable',
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.3,
  value_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_blueprint_framework_signal UNIQUE (blueprint_id, signal_key)
);

CREATE INDEX IF NOT EXISTS idx_blueprint_framework_signals_blueprint
  ON blueprint_framework_signals (blueprint_id);
