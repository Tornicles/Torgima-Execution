-- BHUDHI PROMPT 16 — Decision Intelligence Engine (BDIE)

CREATE TABLE IF NOT EXISTS bhudhi_decision_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  recommendation_id uuid,
  trigger text NOT NULL,
  goal text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_option_id text,
  confidence double precision NOT NULL DEFAULT 0.5,
  confidence_level text NOT NULL DEFAULT 'MEDIUM',
  explanation text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  approval_status text NOT NULL DEFAULT 'pending',
  governance_escalated boolean NOT NULL DEFAULT false,
  actual_outcome jsonb,
  regret_score double precision,
  quality_score double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_decision_records_blueprint_id ON bhudhi_decision_records(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_decision_records_recommendation_id ON bhudhi_decision_records(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_decision_records_status ON bhudhi_decision_records(status);

CREATE TABLE IF NOT EXISTS bhudhi_decision_options (
  id text NOT NULL,
  decision_id uuid NOT NULL REFERENCES bhudhi_decision_records(id) ON DELETE CASCADE,
  label text NOT NULL,
  option_type text NOT NULL,
  description text NOT NULL,
  cost double precision NOT NULL DEFAULT 0,
  timeline_days integer NOT NULL DEFAULT 0,
  risk double precision NOT NULL DEFAULT 0.5,
  confidence double precision NOT NULL DEFAULT 0.5,
  expected_value double precision NOT NULL DEFAULT 0,
  selected boolean NOT NULL DEFAULT false,
  tradeoffs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (decision_id, id)
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_decision_options_decision_id ON bhudhi_decision_options(decision_id);

CREATE TABLE IF NOT EXISTS bhudhi_decision_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES bhudhi_decision_records(id) ON DELETE CASCADE,
  horizon_days integer NOT NULL,
  best_outcome double precision NOT NULL,
  expected_outcome double precision NOT NULL,
  worst_outcome double precision NOT NULL,
  probabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  scenario_tree jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_decision_forecasts_decision_id ON bhudhi_decision_forecasts(decision_id);

CREATE TABLE IF NOT EXISTS bhudhi_decision_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES bhudhi_decision_records(id) ON DELETE CASCADE,
  option_id text NOT NULL,
  expected_value double precision NOT NULL,
  regret double precision NOT NULL DEFAULT 0,
  upside double precision NOT NULL DEFAULT 0,
  downside double precision NOT NULL DEFAULT 0,
  recommendation text NOT NULL,
  tradeoff_matrix jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_decision_scores_decision_id ON bhudhi_decision_scores(decision_id);

CREATE TABLE IF NOT EXISTS bhudhi_decision_replay (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES bhudhi_decision_records(id) ON DELETE CASCADE,
  replay_type text NOT NULL,
  branch_option_id text,
  what_happened text NOT NULL,
  what_should_happen text NOT NULL,
  what_would_happen text NOT NULL,
  learnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_decision_replay_decision_id ON bhudhi_decision_replay(decision_id);
