-- BHUDHI PROMPT 32 — Unified Memory Graph

CREATE TABLE IF NOT EXISTS bhudhi_memory_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  node_type text NOT NULL,
  node_id text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text NOT NULL,
  source_engine text NOT NULL,
  source_event text,
  confidence double precision NOT NULL DEFAULT 0.75,
  importance double precision NOT NULL DEFAULT 0.5,
  verified boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  access_count integer NOT NULL DEFAULT 0,
  last_access_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_bhudhi_memory_nodes_blueprint_type_id
  ON bhudhi_memory_nodes(blueprint_id, node_type, node_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_memory_nodes_blueprint_id ON bhudhi_memory_nodes(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_memory_nodes_node_type ON bhudhi_memory_nodes(node_type);

CREATE TABLE IF NOT EXISTS bhudhi_memory_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL REFERENCES bhudhi_memory_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES bhudhi_memory_nodes(id) ON DELETE CASCADE,
  edge_type text NOT NULL,
  strength double precision NOT NULL DEFAULT 0.7,
  bidirectional boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_bhudhi_memory_edges
  ON bhudhi_memory_edges(blueprint_id, from_node_id, to_node_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_bhudhi_memory_edges_blueprint_id ON bhudhi_memory_edges(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_memory_edges_from ON bhudhi_memory_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_memory_edges_to ON bhudhi_memory_edges(to_node_id);

CREATE TABLE IF NOT EXISTS bhudhi_memory_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  query text NOT NULL,
  node_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_count integer NOT NULL DEFAULT 0,
  execution_time_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_memory_queries_blueprint_id ON bhudhi_memory_queries(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_memory_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  node_id uuid REFERENCES bhudhi_memory_nodes(id) ON DELETE SET NULL,
  event text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_memory_timeline_blueprint_id ON bhudhi_memory_timeline(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_memory_timeline_timestamp ON bhudhi_memory_timeline(timestamp);

CREATE TABLE IF NOT EXISTS bhudhi_memory_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  node_id_1 uuid NOT NULL REFERENCES bhudhi_memory_nodes(id) ON DELETE CASCADE,
  node_id_2 uuid NOT NULL REFERENCES bhudhi_memory_nodes(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  strength double precision NOT NULL DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_memory_relationships_blueprint_id ON bhudhi_memory_relationships(blueprint_id);
