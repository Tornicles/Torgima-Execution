-- BHUDHI Phase 7 — Psychology layer tables

CREATE TABLE IF NOT EXISTS identity_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  self_image TEXT,
  identity_stage TEXT NOT NULL DEFAULT 'FORMING',
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  confidence_trend TEXT NOT NULL DEFAULT 'STABLE',
  purpose_alignment DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  primary_identity TEXT,
  aspirational_identity TEXT,
  execution_identity TEXT,
  active_conflicts JSONB NOT NULL DEFAULT '[]'::jsonb,
  conflict_count INTEGER NOT NULL DEFAULT 0,
  milestones_reached JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_milestone_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_profiles_user_id ON identity_profiles(user_id);

CREATE TABLE IF NOT EXISTS character_progression (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  consistency DOUBLE PRECISION NOT NULL DEFAULT 0,
  grit DOUBLE PRECISION NOT NULL DEFAULT 0,
  discipline DOUBLE PRECISION NOT NULL DEFAULT 0,
  execution_intelligence DOUBLE PRECISION NOT NULL DEFAULT 0,
  adaptability DOUBLE PRECISION NOT NULL DEFAULT 0,
  overall_character_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  character_level INTEGER NOT NULL DEFAULT 1,
  trait_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_character_progression_user_id ON character_progression(user_id);

CREATE TABLE IF NOT EXISTS burnout_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL,
  risk_score DOUBLE PRECISION NOT NULL,
  evidence_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  completion_rate_drop DOUBLE PRECISION,
  score_divergence DOUBLE PRECISION,
  reflection_quality_drop DOUBLE PRECISION,
  consecutive_declines INTEGER,
  session_frequency_drop DOUBLE PRECISION,
  recommendation TEXT NOT NULL,
  action_taken TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_burnout_records_user_created ON burnout_records(user_id, created_at DESC);

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

CREATE TABLE IF NOT EXISTS pattern_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  first_detected TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_confirmed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  actionable BOOLEAN NOT NULL DEFAULT FALSE,
  recommendation TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pattern_records_user_active ON pattern_records(user_id, is_active);

CREATE TABLE IF NOT EXISTS outcome_validation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  proof_quality_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  proof_type TEXT,
  missing_criteria TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  false_progress_risk TEXT NOT NULL DEFAULT 'NONE',
  false_progress_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  divergence_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_verdict TEXT NOT NULL,
  proof_requirement_adjusted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcome_validation_records_feedback ON outcome_validation_records(feedback_id);

ALTER TABLE reward_events
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS evidence_summary TEXT,
  ADD COLUMN IF NOT EXISTS reward_level TEXT DEFAULT 'MINOR',
  ADD COLUMN IF NOT EXISTS seen BOOLEAN NOT NULL DEFAULT FALSE;
