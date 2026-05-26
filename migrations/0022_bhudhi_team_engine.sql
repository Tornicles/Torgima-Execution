-- BHUDHI PROMPT 27 — Team Intelligence Engine (BTIE)

CREATE TABLE IF NOT EXISTS bhudhi_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  name text NOT NULL,
  team_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  alignment double precision NOT NULL DEFAULT 0.5,
  capacity jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendation text,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_teams_blueprint_id ON bhudhi_teams(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_team_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES bhudhi_teams(id) ON DELETE CASCADE,
  mission text,
  values jsonb NOT NULL DEFAULT '[]'::jsonb,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  blindspots jsonb NOT NULL DEFAULT '[]'::jsonb,
  working_style text,
  health double precision NOT NULL DEFAULT 0.5,
  drift double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_team_identity_team_id ON bhudhi_team_identity(team_id);

CREATE TABLE IF NOT EXISTS bhudhi_team_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES bhudhi_teams(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_team_memory_team_id ON bhudhi_team_memory(team_id);

CREATE TABLE IF NOT EXISTS bhudhi_team_alignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES bhudhi_teams(id) ON DELETE CASCADE,
  goal_alignment double precision NOT NULL DEFAULT 0.5,
  strategy_alignment double precision NOT NULL DEFAULT 0.5,
  identity_alignment double precision NOT NULL DEFAULT 0.5,
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_team_alignment_team_id ON bhudhi_team_alignment(team_id);

CREATE TABLE IF NOT EXISTS bhudhi_team_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES bhudhi_teams(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 50,
  burnout double precision NOT NULL DEFAULT 0,
  load double precision NOT NULL DEFAULT 0,
  trust double precision NOT NULL DEFAULT 0.5,
  momentum double precision NOT NULL DEFAULT 0.5,
  engagement double precision NOT NULL DEFAULT 0.5,
  action text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_team_health_team_id ON bhudhi_team_health(team_id);
