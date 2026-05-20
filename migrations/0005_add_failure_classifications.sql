CREATE TABLE IF NOT EXISTS failure_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  primary_candidate TEXT NOT NULL,
  primary_likelihood DOUBLE PRECISION NOT NULL,
  secondary_candidate TEXT,
  secondary_likelihood DOUBLE PRECISION,
  tertiary_candidate TEXT,
  tertiary_likelihood DOUBLE PRECISION,
  evidence_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  system_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failure_classifications_feedback ON failure_classifications(feedback_id);
