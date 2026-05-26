-- BHUDHI PROMPT 28 — Erector Runtime Engine (BERE)

CREATE TABLE IF NOT EXISTS bhudhi_simulation_worlds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'STANDARD',
  seed text NOT NULL,
  world jsonb NOT NULL DEFAULT '{}'::jsonb,
  realism double precision NOT NULL DEFAULT 0.7,
  difficulty double precision NOT NULL DEFAULT 0.5,
  volatility double precision NOT NULL DEFAULT 0.3,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_simulation_worlds_blueprint_id ON bhudhi_simulation_worlds(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid NOT NULL,
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  world_id uuid REFERENCES bhudhi_simulation_worlds(id) ON DELETE SET NULL,
  goal text,
  status text NOT NULL DEFAULT 'pending',
  outcomes jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence double precision NOT NULL DEFAULT 0.5,
  recommendation text,
  seed text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_simulation_runs_blueprint_id ON bhudhi_simulation_runs(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_simulation_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES bhudhi_simulation_runs(id) ON DELETE CASCADE,
  survival integer NOT NULL DEFAULT 50,
  goal_achievement integer NOT NULL DEFAULT 50,
  efficiency integer NOT NULL DEFAULT 50,
  resilience integer NOT NULL DEFAULT 50,
  risk integer NOT NULL DEFAULT 50,
  overall integer NOT NULL DEFAULT 50,
  confidence double precision NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_simulation_scores_run_id ON bhudhi_simulation_scores(run_id);

CREATE TABLE IF NOT EXISTS bhudhi_simulation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES bhudhi_simulation_runs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_simulation_events_run_id ON bhudhi_simulation_events(run_id);

CREATE TABLE IF NOT EXISTS bhudhi_simulation_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_simulation_memory_blueprint_id ON bhudhi_simulation_memory(blueprint_id);
