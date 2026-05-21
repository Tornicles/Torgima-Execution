-- IL2 — outcome validation & false progress (DOC_20)

ALTER TABLE outcome_validations
  ADD COLUMN IF NOT EXISTS target_id UUID REFERENCES targets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS real_outcome_id UUID REFERENCES real_outcomes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validation_result TEXT,
  ADD COLUMN IF NOT EXISTS evidence_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS evidence_summary TEXT,
  ADD COLUMN IF NOT EXISTS validator_source TEXT DEFAULT 'SYSTEM',
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

ALTER TABLE false_progress_flags
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS resolution_task_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE real_outcomes
  ADD COLUMN IF NOT EXISTS outcome_type TEXT,
  ADD COLUMN IF NOT EXISTS claimed_value TEXT,
  ADD COLUMN IF NOT EXISTS evidence_text TEXT,
  ADD COLUMN IF NOT EXISTS proof_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_outcome_validations_validation_result
  ON outcome_validations(blueprint_id, validation_result);
