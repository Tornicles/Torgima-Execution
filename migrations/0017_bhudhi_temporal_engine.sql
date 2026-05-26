-- BHUDHI PROMPT 22 — Temporal Intelligence Engine (BTIE)

CREATE TABLE IF NOT EXISTS bhudhi_temporal_timelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  goal text,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  ordering jsonb NOT NULL DEFAULT '[]'::jsonb,
  causes jsonb NOT NULL DEFAULT '[]'::jsonb,
  health double precision NOT NULL DEFAULT 0.5,
  buffer_days integer NOT NULL DEFAULT 0,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_temporal_timelines_blueprint_id ON bhudhi_temporal_timelines(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_temporal_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  window_type text NOT NULL,
  label text NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  score integer NOT NULL DEFAULT 50,
  success_probability double precision NOT NULL DEFAULT 0.5,
  expires_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_temporal_windows_blueprint_id ON bhudhi_temporal_windows(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_temporal_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  horizon_days integer NOT NULL,
  forecast jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence double precision NOT NULL DEFAULT 0.5,
  adjustments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_temporal_forecasts_blueprint_id ON bhudhi_temporal_forecasts(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_temporal_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  pattern_type text NOT NULL,
  description text NOT NULL,
  momentum_mode text,
  score double precision NOT NULL DEFAULT 0.5,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_temporal_patterns_blueprint_id ON bhudhi_temporal_patterns(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_temporal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  time_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  urgency double precision NOT NULL DEFAULT 0.5,
  recommendation text NOT NULL,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_temporal_history_blueprint_id ON bhudhi_temporal_history(blueprint_id);
