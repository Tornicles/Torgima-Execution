-- BHUDHI PROMPT 33 — BHUDHI:// Protocol Layer

CREATE TABLE IF NOT EXISTS bhudhi_protocol_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  version text NOT NULL DEFAULT '1.0',
  message_type text NOT NULL,
  from_engine text NOT NULL,
  to_engine text NOT NULL DEFAULT 'broadcast',
  uri text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  route_id text NOT NULL,
  sequence_number integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_protocol_messages_blueprint_id ON bhudhi_protocol_messages(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_protocol_messages_uri ON bhudhi_protocol_messages(uri);
CREATE INDEX IF NOT EXISTS idx_bhudhi_protocol_messages_from_engine ON bhudhi_protocol_messages(from_engine);
CREATE INDEX IF NOT EXISTS idx_bhudhi_protocol_messages_to_engine ON bhudhi_protocol_messages(to_engine);

CREATE TABLE IF NOT EXISTS bhudhi_protocol_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL UNIQUE,
  handler text NOT NULL,
  request_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  async boolean NOT NULL DEFAULT true,
  timeout_ms integer NOT NULL DEFAULT 30000,
  retries integer NOT NULL DEFAULT 3,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bhudhi_protocol_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_a text NOT NULL,
  engine_b text NOT NULL,
  message_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  guarantees jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engine_a, engine_b)
);
