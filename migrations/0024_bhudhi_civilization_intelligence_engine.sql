-- BHUDHI PROMPT 29 — Civilization Intelligence Engine (BCIE)

CREATE TABLE IF NOT EXISTS bhudhi_civilizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Blueprint Civilization',
  civilization_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  resilience double precision NOT NULL DEFAULT 0.5,
  trajectory text NOT NULL DEFAULT 'stable',
  evolution_mode text NOT NULL DEFAULT 'stable',
  seed text NOT NULL,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_civilizations_blueprint_id ON bhudhi_civilizations(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_civilization_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  civilization_id uuid NOT NULL REFERENCES bhudhi_civilizations(id) ON DELETE CASCADE,
  phase text NOT NULL,
  population_health double precision NOT NULL DEFAULT 0.5,
  institution_effectiveness double precision NOT NULL DEFAULT 0.5,
  ecosystem_health double precision NOT NULL DEFAULT 0.5,
  economic_trajectory text NOT NULL DEFAULT 'stable',
  resilience_score integer NOT NULL DEFAULT 50,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_civilization_states_civilization_id ON bhudhi_civilization_states(civilization_id);

CREATE TABLE IF NOT EXISTS bhudhi_civilization_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  civilization_id uuid NOT NULL REFERENCES bhudhi_civilizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_civilization_events_civilization_id ON bhudhi_civilization_events(civilization_id);

CREATE TABLE IF NOT EXISTS bhudhi_civilization_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  civilization_id uuid NOT NULL REFERENCES bhudhi_civilizations(id) ON DELETE CASCADE,
  horizon_years integer NOT NULL,
  trajectory text NOT NULL,
  confidence double precision NOT NULL DEFAULT 0.5,
  forecast jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_civilization_forecasts_civilization_id ON bhudhi_civilization_forecasts(civilization_id);

CREATE TABLE IF NOT EXISTS bhudhi_civilization_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  civilization_id uuid REFERENCES bhudhi_civilizations(id) ON DELETE SET NULL,
  memory_type text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_civilization_memory_blueprint_id ON bhudhi_civilization_memory(blueprint_id);
