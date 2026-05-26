-- BHUDHI PROMPT 20 — Organization Operating System (BOOS)

CREATE TABLE IF NOT EXISTS bhudhi_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  name text NOT NULL,
  organization_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  capacity jsonb NOT NULL DEFAULT '{}'::jsonb,
  alignment double precision NOT NULL DEFAULT 0.5,
  health_score integer NOT NULL DEFAULT 50,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_organizations_blueprint_id ON bhudhi_organizations(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_organization_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES bhudhi_organizations(id) ON DELETE CASCADE,
  user_id uuid,
  role_key text NOT NULL,
  authority_level text NOT NULL DEFAULT 'MEMBER',
  department text,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_organization_roles_org_id ON bhudhi_organization_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_organization_roles_user_id ON bhudhi_organization_roles(user_id);

CREATE TABLE IF NOT EXISTS bhudhi_organization_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES bhudhi_organizations(id) ON DELETE CASCADE,
  execution_score double precision NOT NULL DEFAULT 0.5,
  culture_score double precision NOT NULL DEFAULT 0.5,
  strategy_score double precision NOT NULL DEFAULT 0.5,
  risk_score double precision NOT NULL DEFAULT 0.5,
  resilience_score double precision NOT NULL DEFAULT 0.5,
  overall_score integer NOT NULL DEFAULT 50,
  action text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_organization_health_org_id ON bhudhi_organization_health(organization_id);

CREATE TABLE IF NOT EXISTS bhudhi_organization_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES bhudhi_organizations(id) ON DELETE CASCADE,
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text NOT NULL,
  action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_organization_events_org_id ON bhudhi_organization_events(organization_id);

CREATE TABLE IF NOT EXISTS bhudhi_organization_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES bhudhi_organizations(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_organization_memory_org_id ON bhudhi_organization_memory(organization_id);
