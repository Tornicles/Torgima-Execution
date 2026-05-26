-- BHUDHI PROMPT 17 — Belief Architecture Engine (BBAE)

CREATE TABLE IF NOT EXISTS bhudhi_belief_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id uuid,
  trigger text,
  belief_type text NOT NULL,
  statement text NOT NULL,
  origin text NOT NULL,
  state text NOT NULL DEFAULT 'OBSERVED',
  confidence double precision NOT NULL DEFAULT 0.5,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  truth_score double precision,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_belief_records_blueprint_id ON bhudhi_belief_records(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_belief_records_state ON bhudhi_belief_records(state);
CREATE INDEX IF NOT EXISTS idx_bhudhi_belief_records_belief_type ON bhudhi_belief_records(belief_type);

CREATE TABLE IF NOT EXISTS bhudhi_belief_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  belief_id uuid NOT NULL REFERENCES bhudhi_belief_records(id) ON DELETE CASCADE,
  source text NOT NULL,
  reliability double precision NOT NULL DEFAULT 0.5,
  recency double precision NOT NULL DEFAULT 0.5,
  agreement double precision NOT NULL DEFAULT 0.5,
  repeatability double precision NOT NULL DEFAULT 0.5,
  evidence_score double precision NOT NULL DEFAULT 0.5,
  strength text NOT NULL DEFAULT 'moderate',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_belief_evidence_belief_id ON bhudhi_belief_evidence(belief_id);

CREATE TABLE IF NOT EXISTS bhudhi_belief_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  belief_id uuid NOT NULL REFERENCES bhudhi_belief_records(id) ON DELETE CASCADE,
  change_type text NOT NULL,
  previous_state text,
  new_state text NOT NULL,
  reason text NOT NULL,
  confidence_before double precision,
  confidence_after double precision,
  quality_score double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_belief_history_belief_id ON bhudhi_belief_history(belief_id);

CREATE TABLE IF NOT EXISTS bhudhi_belief_truth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  belief_id uuid NOT NULL REFERENCES bhudhi_belief_records(id) ON DELETE CASCADE,
  truth_score double precision NOT NULL,
  stability double precision NOT NULL DEFAULT 0.5,
  certainty double precision NOT NULL DEFAULT 0.5,
  category text NOT NULL DEFAULT 'LOCAL',
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_belief_truth_belief_id ON bhudhi_belief_truth(belief_id);

CREATE TABLE IF NOT EXISTS bhudhi_belief_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  belief_id_a uuid REFERENCES bhudhi_belief_records(id) ON DELETE SET NULL,
  belief_id_b uuid REFERENCES bhudhi_belief_records(id) ON DELETE SET NULL,
  conflict_type text NOT NULL,
  description text NOT NULL,
  action text NOT NULL DEFAULT 'investigate',
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_belief_conflicts_blueprint_id ON bhudhi_belief_conflicts(blueprint_id);
