-- BHUDHI PROMPT 15 — Intelligence Economics Engine (BIEE)

CREATE TABLE IF NOT EXISTS bhudhi_economics_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  blueprint_id uuid REFERENCES blueprints(id) ON DELETE CASCADE,
  daily_token_budget integer NOT NULL DEFAULT 100000,
  daily_usd_budget double precision NOT NULL DEFAULT 5,
  target_confidence double precision NOT NULL DEFAULT 0.8,
  execution_mode text NOT NULL DEFAULT 'STANDARD',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_economics_profiles_user_id ON bhudhi_economics_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_economics_profiles_blueprint_id ON bhudhi_economics_profiles(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_model_capabilities (
  id text PRIMARY KEY,
  model_id text NOT NULL UNIQUE,
  provider text NOT NULL,
  cost_per_million double precision NOT NULL,
  latency_ms integer NOT NULL DEFAULT 3000,
  quality double precision NOT NULL DEFAULT 0.75,
  risk double precision NOT NULL DEFAULT 0.2,
  reliability double precision NOT NULL DEFAULT 0.85,
  memory_fit double precision NOT NULL DEFAULT 0.7,
  tool_fit double precision NOT NULL DEFAULT 0.5,
  simulation_fit double precision NOT NULL DEFAULT 0.5,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bhudhi_economics_rules (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  action jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bhudhi_economics_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  blueprint_id uuid REFERENCES blueprints(id) ON DELETE SET NULL,
  trigger_type text NOT NULL,
  execution_mode text NOT NULL,
  route text NOT NULL,
  model_id text NOT NULL,
  estimated_cost_usd double precision NOT NULL DEFAULT 0,
  actual_cost_usd double precision,
  estimated_latency_ms integer NOT NULL DEFAULT 0,
  actual_latency_ms integer,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  confidence_target double precision NOT NULL DEFAULT 0.8,
  value_score double precision NOT NULL DEFAULT 0,
  cache_hit boolean NOT NULL DEFAULT false,
  roi_action text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_economics_sessions_user_id ON bhudhi_economics_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_economics_sessions_blueprint_id ON bhudhi_economics_sessions(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_economics_sessions_created_at ON bhudhi_economics_sessions(created_at);

CREATE TABLE IF NOT EXISTS bhudhi_economics_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES bhudhi_economics_sessions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  category text NOT NULL,
  amount_usd double precision NOT NULL DEFAULT 0,
  tokens integer NOT NULL DEFAULT 0,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_economics_logs_user_id ON bhudhi_economics_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_economics_logs_session_id ON bhudhi_economics_logs(session_id);

CREATE TABLE IF NOT EXISTS bhudhi_economics_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  blueprint_id uuid REFERENCES blueprints(id) ON DELETE CASCADE,
  horizon_days integer NOT NULL,
  forecast_cost_usd double precision NOT NULL,
  forecast_tokens integer NOT NULL,
  forecast_requests integer NOT NULL,
  forecast_memory_mb double precision NOT NULL DEFAULT 0,
  forecast_simulation_hours double precision NOT NULL DEFAULT 0,
  confidence double precision NOT NULL DEFAULT 0.7,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_economics_forecasts_user_id ON bhudhi_economics_forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_economics_forecasts_horizon ON bhudhi_economics_forecasts(horizon_days);
