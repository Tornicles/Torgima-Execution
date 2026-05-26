-- BHUDHI PROMPT 30 — AGI Expansion Engine (BAEE)

CREATE TABLE IF NOT EXISTS bhudhi_expansion_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  capability_key text NOT NULL,
  origin text NOT NULL,
  level text NOT NULL DEFAULT 'LOCAL',
  status text NOT NULL DEFAULT 'candidate',
  score double precision NOT NULL DEFAULT 0.5,
  risk double precision NOT NULL DEFAULT 0.3,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_expansion_capabilities_blueprint_id ON bhudhi_expansion_capabilities(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_expansion_capabilities_key ON bhudhi_expansion_capabilities(capability_key);

CREATE TABLE IF NOT EXISTS bhudhi_expansion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  capability_id uuid REFERENCES bhudhi_expansion_capabilities(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_expansion_events_blueprint_id ON bhudhi_expansion_events(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_expansion_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id uuid NOT NULL REFERENCES bhudhi_expansion_capabilities(id) ON DELETE CASCADE,
  gain double precision NOT NULL DEFAULT 0,
  cost double precision NOT NULL DEFAULT 0,
  confidence double precision NOT NULL DEFAULT 0.5,
  benchmark jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_expansion_benchmarks_capability_id ON bhudhi_expansion_benchmarks(capability_id);

CREATE TABLE IF NOT EXISTS bhudhi_expansion_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  action text NOT NULL,
  capability_key text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_expansion_history_blueprint_id ON bhudhi_expansion_history(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_expansion_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_expansion_memory_blueprint_id ON bhudhi_expansion_memory(blueprint_id);
