-- BHUDHI PROMPT 31 — Unified Cognitive Kernel & Event Bus

CREATE TABLE IF NOT EXISTS bhudhi_kernel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  source_engine text NOT NULL,
  target_engine text NOT NULL DEFAULT 'broadcast',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'emitted',
  processed_by jsonb NOT NULL DEFAULT '[]'::jsonb,
  parent_event_id uuid,
  chain_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_kernel_events_blueprint_id ON bhudhi_kernel_events(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_kernel_events_event_type ON bhudhi_kernel_events(event_type);
CREATE INDEX IF NOT EXISTS idx_bhudhi_kernel_events_chain_id ON bhudhi_kernel_events(chain_id);

CREATE TABLE IF NOT EXISTS bhudhi_shared_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  domain text NOT NULL DEFAULT 'genesis',
  phase text NOT NULL DEFAULT 'initiation',
  signal text NOT NULL DEFAULT 'nothingness',
  condition text NOT NULL DEFAULT 'nothingness',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ideas jsonb NOT NULL DEFAULT '{}'::jsonb,
  strategy jsonb NOT NULL DEFAULT '{}'::jsonb,
  predictions jsonb NOT NULL DEFAULT '{}'::jsonb,
  knowledge jsonb NOT NULL DEFAULT '{}'::jsonb,
  behavior jsonb NOT NULL DEFAULT '{}'::jsonb,
  execution jsonb NOT NULL DEFAULT '{}'::jsonb,
  investigations jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_update_engine text NOT NULL DEFAULT 'system',
  last_update_time timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_shared_context_blueprint_id ON bhudhi_shared_context(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_engine_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_id text NOT NULL UNIQUE,
  engine_name text NOT NULL,
  system text NOT NULL,
  accepts_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  emits_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_context jsonb NOT NULL DEFAULT '[]'::jsonb,
  produces_context jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  health_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_engine_registry_system ON bhudhi_engine_registry(system);

CREATE TABLE IF NOT EXISTS bhudhi_execution_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  contract_type text NOT NULL,
  execution_id text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  event_chain_id text,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  stack_trace text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_execution_contracts_blueprint_id ON bhudhi_execution_contracts(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_execution_contracts_contract_type ON bhudhi_execution_contracts(contract_type);
CREATE INDEX IF NOT EXISTS idx_bhudhi_execution_contracts_status ON bhudhi_execution_contracts(status);
