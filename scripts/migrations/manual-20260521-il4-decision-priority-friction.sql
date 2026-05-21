-- IL4 — decision trace audit fields, cognitive load detail, feedback friction signals (DOC_23–25)

ALTER TABLE decision_traces
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS engine_source TEXT,
  ADD COLUMN IF NOT EXISTS input_summary TEXT,
  ADD COLUMN IF NOT EXISTS output_summary TEXT,
  ADD COLUMN IF NOT EXISTS alternatives_considered JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS state_version INTEGER;

ALTER TABLE cognitive_load_scores
  ADD COLUMN IF NOT EXISTS choice_count INTEGER,
  ADD COLUMN IF NOT EXISTS decision_latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS reversal_count INTEGER,
  ADD COLUMN IF NOT EXISTS ambiguity_flags INTEGER,
  ADD COLUMN IF NOT EXISTS load_category TEXT;

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS difficulty_felt TEXT,
  ADD COLUMN IF NOT EXISTS submitted_hours_after_completion DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_decision_traces_user_id ON decision_traces(user_id);
