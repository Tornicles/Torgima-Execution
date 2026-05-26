-- BHUDHI PROMPT 25 — Security Engine (BSE)

CREATE TABLE IF NOT EXISTS bhudhi_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id text,
  trust_score double precision NOT NULL DEFAULT 0.5,
  risk double precision NOT NULL DEFAULT 0,
  decision text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_security_events_blueprint_id ON bhudhi_security_events(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_trust_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  subject_id text NOT NULL,
  trust_level text NOT NULL DEFAULT 'LIMITED',
  trust_score double precision NOT NULL DEFAULT 0.5,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_trust_profiles_blueprint_id ON bhudhi_trust_profiles(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_threat_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  threat text NOT NULL,
  severity text NOT NULL,
  containment text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_threat_records_blueprint_id ON bhudhi_threat_records(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_permission_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  subject_id text NOT NULL,
  permission text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_permission_history_blueprint_id ON bhudhi_permission_history(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_secret_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  secret_key text NOT NULL,
  secret_type text NOT NULL,
  vault_ref text NOT NULL,
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_secret_registry_blueprint_id ON bhudhi_secret_registry(blueprint_id);
