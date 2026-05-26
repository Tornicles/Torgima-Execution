-- BHUDHI PROMPT 13 — Bhudhi 2.0: 8 Torgima AI modules + runtime tables

CREATE TABLE IF NOT EXISTS bhudhi_modules (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  system text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  logic jsonb NOT NULL DEFAULT '{}'::jsonb,
  accuracy double precision NOT NULL DEFAULT 0.75,
  execution_time_ms integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_modules_system ON bhudhi_modules(system);

CREATE TABLE IF NOT EXISTS bhudhi_context_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  current_domain text NOT NULL,
  current_phase text NOT NULL,
  resources jsonb NOT NULL DEFAULT '{}'::jsonb,
  constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  urgency text NOT NULL,
  clarity double precision NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_context_states_blueprint_id ON bhudhi_context_states(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_idea_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  problem text NOT NULL,
  ideas jsonb NOT NULL DEFAULT '[]'::jsonb,
  feasibility jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_idea text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_idea_sets_blueprint_id ON bhudhi_idea_sets(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_strategic_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected text NOT NULL,
  reasoning text NOT NULL,
  alignment double precision NOT NULL DEFAULT 0.5,
  confidence double precision NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_strategic_choices_blueprint_id ON bhudhi_strategic_choices(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  scenario text NOT NULL,
  forecast jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence double precision NOT NULL DEFAULT 0.5,
  timeline integer NOT NULL DEFAULT 0,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  opportunities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_predictions_blueprint_id ON bhudhi_predictions(blueprint_id);

CREATE TABLE IF NOT EXISTS bhudhi_execution_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  recommendation_id uuid,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeline jsonb NOT NULL DEFAULT '{}'::jsonb,
  resources jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  monitoring jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'planned',
  progress integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_execution_plans_blueprint_id ON bhudhi_execution_plans(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_execution_plans_recommendation_id ON bhudhi_execution_plans(recommendation_id);
