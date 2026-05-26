-- BHUDHI PROMPT 1 — Intelligence layer catalog + runtime tables

CREATE TABLE IF NOT EXISTS bhudhi_systems (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_analyzed_at timestamptz,
  engine_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_systems_status ON bhudhi_systems(status);

CREATE TABLE IF NOT EXISTS bhudhi_engines (
  id text PRIMARY KEY,
  system_id text NOT NULL REFERENCES bhudhi_systems(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_run_at timestamptz,
  next_run_at timestamptz,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{"executionsCount":0,"successRate":0,"averageExecutionTime":0,"lastResultCount":0}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system_id, name)
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_engines_system_id ON bhudhi_engines(system_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_engines_status ON bhudhi_engines(status);

CREATE TABLE IF NOT EXISTS bhudhi_frameworks (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  type text NOT NULL,
  description text NOT NULL,
  domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  logic jsonb NOT NULL DEFAULT '{}'::jsonb,
  accuracy double precision NOT NULL DEFAULT 0.5,
  confidence_threshold double precision NOT NULL DEFAULT 0.7,
  improvement_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  weekly_accuracy jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_frameworks_status ON bhudhi_frameworks(status);

CREATE TABLE IF NOT EXISTS bhudhi_domains (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  active_frameworks jsonb NOT NULL DEFAULT '[]'::jsonb,
  framework_roles jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bhudhi_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  global_signal text NOT NULL,
  global_signal_confidence double precision NOT NULL DEFAULT 0.5,
  framework_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_signals_blueprint_id ON bhudhi_signals(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  engine_id text NOT NULL REFERENCES bhudhi_engines(id) ON DELETE CASCADE,
  subject text NOT NULL,
  findings jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence double precision NOT NULL DEFAULT 0.5,
  severity text NOT NULL DEFAULT 'low',
  actionable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_investigations_blueprint_id ON bhudhi_investigations(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_investigations_engine_id ON bhudhi_investigations(engine_id);

CREATE TABLE IF NOT EXISTS bhudhi_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  engine_id text NOT NULL REFERENCES bhudhi_engines(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  reasoning text NOT NULL,
  expected_impact jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence double precision NOT NULL DEFAULT 0.5,
  implementation_difficulty text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_recommendations_blueprint_id ON bhudhi_recommendations(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_recommendations_engine_id ON bhudhi_recommendations(engine_id);

CREATE TABLE IF NOT EXISTS bhudhi_execution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  learnings_generated jsonb NOT NULL DEFAULT '[]'::jsonb,
  frameworks_improved jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_execution_events_blueprint_id ON bhudhi_execution_events(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_framework_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id text NOT NULL REFERENCES bhudhi_frameworks(id) ON DELETE CASCADE,
  learning_type text NOT NULL,
  previous_accuracy double precision NOT NULL,
  new_accuracy double precision NOT NULL,
  improvement double precision NOT NULL,
  source_event uuid,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending_validation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_framework_learning_framework_id ON bhudhi_framework_learning(framework_id);

CREATE TABLE IF NOT EXISTS bhudhi_external_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  system_name text NOT NULL,
  system_type text NOT NULL,
  api_key_encrypted text,
  api_endpoint text,
  credentials_encrypted text,
  sync_frequency text NOT NULL DEFAULT 'daily',
  last_sync_at timestamptz,
  next_sync_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_external_connections_blueprint_id ON bhudhi_external_connections(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_external_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES bhudhi_external_connections(id) ON DELETE CASCADE,
  data_type text NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  investigation_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_external_data_connection_id ON bhudhi_external_data(connection_id);

-- updated_at triggers (match repo convention)
DO $$ BEGIN
  CREATE TRIGGER trg_bhudhi_systems_updated_at
    BEFORE UPDATE ON bhudhi_systems FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bhudhi_engines_updated_at
    BEFORE UPDATE ON bhudhi_engines FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bhudhi_frameworks_updated_at
    BEFORE UPDATE ON bhudhi_frameworks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bhudhi_domains_updated_at
    BEFORE UPDATE ON bhudhi_domains FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bhudhi_signals_updated_at
    BEFORE UPDATE ON bhudhi_signals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bhudhi_investigations_updated_at
    BEFORE UPDATE ON bhudhi_investigations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bhudhi_recommendations_updated_at
    BEFORE UPDATE ON bhudhi_recommendations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bhudhi_execution_events_updated_at
    BEFORE UPDATE ON bhudhi_execution_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bhudhi_framework_learning_updated_at
    BEFORE UPDATE ON bhudhi_framework_learning FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bhudhi_external_connections_updated_at
    BEFORE UPDATE ON bhudhi_external_connections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bhudhi_external_data_updated_at
    BEFORE UPDATE ON bhudhi_external_data FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
