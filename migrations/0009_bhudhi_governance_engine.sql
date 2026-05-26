-- BHUDHI Governance Engine — constitutional layer (immutable audit, approvals, emergency)

CREATE TABLE IF NOT EXISTS bhudhi_governance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid REFERENCES blueprints(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  decision text NOT NULL,
  reasoning text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_id uuid,
  result text,
  rollback_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_governance_audit_blueprint_id ON bhudhi_governance_audit(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_governance_audit_event_type ON bhudhi_governance_audit(event_type);
CREATE INDEX IF NOT EXISTS idx_bhudhi_governance_audit_created_at ON bhudhi_governance_audit(created_at);

CREATE TABLE IF NOT EXISTS bhudhi_governance_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  action text NOT NULL,
  level text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  approver_type text,
  approver_id text,
  rejection_reason text,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_governance_approvals_blueprint_id ON bhudhi_governance_approvals(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_governance_approvals_status ON bhudhi_governance_approvals(status);
CREATE INDEX IF NOT EXISTS idx_bhudhi_governance_approvals_subject ON bhudhi_governance_approvals(subject_type, subject_id);

CREATE TABLE IF NOT EXISTS bhudhi_governance_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid REFERENCES blueprints(id) ON DELETE SET NULL,
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  violation_type text NOT NULL,
  severity text NOT NULL,
  detail text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_governance_violations_blueprint_id ON bhudhi_governance_violations(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_governance_emergency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid REFERENCES blueprints(id) ON DELETE CASCADE,
  mode text NOT NULL,
  trigger text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  activated_at timestamptz NOT NULL DEFAULT now(),
  cleared_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_governance_emergency_blueprint_id ON bhudhi_governance_emergency(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_governance_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid REFERENCES blueprints(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_governance_memory_blueprint_id ON bhudhi_governance_memory(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_governance_memory_type_key ON bhudhi_governance_memory(memory_type, key);
