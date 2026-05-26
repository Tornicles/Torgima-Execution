-- BHUDHI PROMPT 19 — Identity Intelligence Engine (BIIE)

CREATE TABLE IF NOT EXISTS bhudhi_identity_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id uuid,
  execution_profile text NOT NULL DEFAULT 'Builder',
  personality jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  motivations jsonb NOT NULL DEFAULT '{}'::jsonb,
  identity_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  growth_direction text,
  confidence double precision NOT NULL DEFAULT 0.5,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_identity_profiles_blueprint_id ON bhudhi_identity_profiles(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_identity_profiles_user_id ON bhudhi_identity_profiles(user_id);

CREATE TABLE IF NOT EXISTS bhudhi_identity_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES bhudhi_identity_profiles(id) ON DELETE CASCADE,
  value_key text NOT NULL,
  rank integer NOT NULL DEFAULT 0,
  protected boolean NOT NULL DEFAULT false,
  temporary boolean NOT NULL DEFAULT false,
  weight double precision NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_identity_values_profile_id ON bhudhi_identity_values(profile_id);

CREATE TABLE IF NOT EXISTS bhudhi_identity_growth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES bhudhi_identity_profiles(id) ON DELETE CASCADE,
  current_state text NOT NULL,
  next_identity text,
  maturity double precision NOT NULL DEFAULT 0.5,
  stability double precision NOT NULL DEFAULT 0.5,
  recommended_transitions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_identity_growth_profile_id ON bhudhi_identity_growth(profile_id);

CREATE TABLE IF NOT EXISTS bhudhi_identity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES bhudhi_identity_profiles(id) ON DELETE CASCADE,
  change_type text NOT NULL,
  previous_snapshot jsonb,
  new_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_identity_history_profile_id ON bhudhi_identity_history(profile_id);

CREATE TABLE IF NOT EXISTS bhudhi_identity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES bhudhi_identity_profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  description text NOT NULL,
  action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_identity_events_blueprint_id ON bhudhi_identity_events(blueprint_id);
