-- BHUDHI PROMPT 23 — Meta Governor Engine (BMGE)

CREATE TABLE IF NOT EXISTS bhudhi_governor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  subsystem text,
  action text NOT NULL,
  priority_level text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_governor_events_blueprint_id ON bhudhi_governor_events(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_governor_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  allocated double precision NOT NULL DEFAULT 0,
  waste double precision NOT NULL DEFAULT 0,
  recommendation text,
  allocation_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_governor_allocations_blueprint_id ON bhudhi_governor_allocations(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_governor_recovery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  recovery_mode text NOT NULL,
  target_subsystem text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  preserved_history boolean NOT NULL DEFAULT true,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_governor_recovery_blueprint_id ON bhudhi_governor_recovery(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_governor_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  priority_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  interventions jsonb NOT NULL DEFAULT '[]'::jsonb,
  execution_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_governor_history_blueprint_id ON bhudhi_governor_history(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_governor_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  quality double precision NOT NULL DEFAULT 0.5,
  drift double precision NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  coordination double precision NOT NULL DEFAULT 0.5,
  efficiency double precision NOT NULL DEFAULT 0.5,
  system_health text NOT NULL DEFAULT 'stable',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_governor_health_blueprint_id ON bhudhi_governor_health(blueprint_id);
