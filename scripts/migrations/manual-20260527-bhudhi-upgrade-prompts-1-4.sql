-- BHUDHI_UPGRADE_PROMPTS_1_TO_4 — external_intelligence + prediction_snapshots
CREATE TABLE IF NOT EXISTS external_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  domain text NOT NULL,
  goal_summary text,
  market_trends jsonb NOT NULL DEFAULT '[]'::jsonb,
  opportunity_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  competitor_moves jsonb NOT NULL DEFAULT '[]'::jsonb,
  execution_recommendation text,
  confidence text NOT NULL DEFAULT 'LOW',
  source_type text NOT NULL DEFAULT 'BHUDHI_KNOWLEDGE',
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_external_intelligence_blueprint ON external_intelligence(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_external_intelligence_expires ON external_intelligence(expires_at);

CREATE TABLE IF NOT EXISTS prediction_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  dropout_risk double precision NOT NULL DEFAULT 0,
  burnout_risk double precision NOT NULL DEFAULT 0,
  plateau_risk double precision NOT NULL DEFAULT 0,
  scaling_readiness double precision NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'LOW',
  primary_risk text,
  primary_opportunity text,
  recommended_action text NOT NULL DEFAULT 'MAINTAIN',
  signal_snapshot_id uuid REFERENCES signal_snapshots(id),
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_blueprint ON prediction_snapshots(blueprint_id);
