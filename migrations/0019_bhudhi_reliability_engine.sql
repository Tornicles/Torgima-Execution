-- BHUDHI PROMPT 24 — Reliability Engine (BRE)

CREATE TABLE IF NOT EXISTS bhudhi_reliability_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  severity text,
  health double precision NOT NULL DEFAULT 0.5,
  risk double precision NOT NULL DEFAULT 0,
  failure_probability double precision NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_reliability_events_blueprint_id ON bhudhi_reliability_events(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_incident_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  owner text,
  sla_hours integer,
  confidence double precision NOT NULL DEFAULT 0.5,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_incident_logs_blueprint_id ON bhudhi_incident_logs(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_rollback_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  target text NOT NULL,
  mode text NOT NULL,
  preserved_history boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'complete',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_rollback_history_blueprint_id ON bhudhi_rollback_history(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_recovery_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  strategy text NOT NULL,
  confidence double precision NOT NULL DEFAULT 0.5,
  estimated_recovery_minutes integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'pending',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_recovery_records_blueprint_id ON bhudhi_recovery_records(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  resilience_score integer NOT NULL DEFAULT 50,
  uptime double precision NOT NULL DEFAULT 0.99,
  availability double precision NOT NULL DEFAULT 0.99,
  continuity_mode text NOT NULL DEFAULT 'ONLINE',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_system_health_blueprint_id ON bhudhi_system_health(blueprint_id);
