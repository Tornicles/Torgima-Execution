-- BHUDHI PROMPT 21 — Experimentation Engine (BEE)

CREATE TABLE IF NOT EXISTS bhudhi_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  goal text NOT NULL,
  hypothesis jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  duration_days integer NOT NULL DEFAULT 7,
  sample_size integer NOT NULL DEFAULT 100,
  confidence_target double precision NOT NULL DEFAULT 0.95,
  success_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_experiments_blueprint_id ON bhudhi_experiments(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bhudhi_experiments_status ON bhudhi_experiments(status);

CREATE TABLE IF NOT EXISTS bhudhi_experiment_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES bhudhi_experiments(id) ON DELETE CASCADE,
  group_key text NOT NULL,
  label text NOT NULL,
  allocation_weight double precision NOT NULL DEFAULT 0.25,
  exposure_count integer NOT NULL DEFAULT 0,
  completion_count integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_experiment_groups_experiment_id ON bhudhi_experiment_groups(experiment_id);

CREATE TABLE IF NOT EXISTS bhudhi_experiment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES bhudhi_experiments(id) ON DELETE CASCADE,
  group_id uuid REFERENCES bhudhi_experiment_groups(id) ON DELETE SET NULL,
  delta double precision NOT NULL DEFAULT 0,
  confidence double precision NOT NULL DEFAULT 0.5,
  effect_size double precision NOT NULL DEFAULT 0,
  verdict text,
  causal jsonb NOT NULL DEFAULT '{}'::jsonb,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_experiment_results_experiment_id ON bhudhi_experiment_results(experiment_id);

CREATE TABLE IF NOT EXISTS bhudhi_experiment_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES bhudhi_experiments(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_class text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_experiment_memory_experiment_id ON bhudhi_experiment_memory(experiment_id);

CREATE TABLE IF NOT EXISTS bhudhi_experiment_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES bhudhi_experiments(id) ON DELETE CASCADE,
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  action text NOT NULL,
  winner_group text,
  confidence double precision NOT NULL,
  repeatability double precision NOT NULL,
  governance_ok boolean NOT NULL DEFAULT false,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_experiment_promotions_experiment_id ON bhudhi_experiment_promotions(experiment_id);
