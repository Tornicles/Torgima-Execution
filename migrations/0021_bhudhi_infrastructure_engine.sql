-- BHUDHI PROMPT 26 — Infrastructure Intelligence Engine (BIIE)

CREATE TABLE IF NOT EXISTS bhudhi_infra_runtime (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  runtime_type text NOT NULL,
  health double precision NOT NULL DEFAULT 0.5,
  latency_ms integer NOT NULL DEFAULT 0,
  throughput double precision NOT NULL DEFAULT 0,
  stability double precision NOT NULL DEFAULT 0.5,
  recommendation text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_infra_runtime_blueprint_id ON bhudhi_infra_runtime(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_infra_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  cpu double precision NOT NULL DEFAULT 0,
  memory double precision NOT NULL DEFAULT 0,
  gpu double precision NOT NULL DEFAULT 0,
  storage double precision NOT NULL DEFAULT 0,
  network double precision NOT NULL DEFAULT 0,
  utilization double precision NOT NULL DEFAULT 0,
  waste double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_infra_capacity_blueprint_id ON bhudhi_infra_capacity(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_infra_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  strategy text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  rollback_available boolean NOT NULL DEFAULT true,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_infra_deployments_blueprint_id ON bhudhi_infra_deployments(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_infra_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  environment text NOT NULL,
  risk double precision NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_infra_events_blueprint_id ON bhudhi_infra_events(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_infra_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  availability double precision NOT NULL DEFAULT 0.99,
  load double precision NOT NULL DEFAULT 0,
  error_rate double precision NOT NULL DEFAULT 0,
  latency_p99_ms integer NOT NULL DEFAULT 0,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_infra_health_blueprint_id ON bhudhi_infra_health(blueprint_id);
