-- BHUDHI PROMPT 18 — World Model Engine (BWME)

CREATE TABLE IF NOT EXISTS bhudhi_world_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  label text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  relationships jsonb NOT NULL DEFAULT '[]'::jsonb,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_world_entities_blueprint_id ON bhudhi_world_entities(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_world_entities_entity_type ON bhudhi_world_entities(entity_type);

CREATE TABLE IF NOT EXISTS bhudhi_world_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES bhudhi_world_entities(id) ON DELETE CASCADE,
  state_type text NOT NULL DEFAULT 'DYNAMIC',
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  predicted_state jsonb,
  desired_state jsonb,
  delta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_world_states_blueprint_id ON bhudhi_world_states(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_world_states_entity_id ON bhudhi_world_states(entity_id);

CREATE TABLE IF NOT EXISTS bhudhi_world_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  from_entity_id uuid NOT NULL REFERENCES bhudhi_world_entities(id) ON DELETE CASCADE,
  to_entity_id uuid NOT NULL REFERENCES bhudhi_world_entities(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  weight double precision NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_world_relationships_blueprint_id ON bhudhi_world_relationships(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_world_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  entity_id uuid REFERENCES bhudhi_world_entities(id) ON DELETE SET NULL,
  cause text,
  impact double precision NOT NULL DEFAULT 0,
  confidence double precision NOT NULL DEFAULT 0.5,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_world_events_blueprint_id ON bhudhi_world_events(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_world_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  world_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence double precision NOT NULL DEFAULT 0.5,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_world_snapshots_blueprint_id ON bhudhi_world_snapshots(blueprint_id);
