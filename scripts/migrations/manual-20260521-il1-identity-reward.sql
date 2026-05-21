-- IL1 — identity continuity & reward audit columns

ALTER TABLE user_identity_states
  ADD COLUMN IF NOT EXISTS stability_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS continuity_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS regression_risk TEXT NOT NULL DEFAULT 'LOW',
  ADD COLUMN IF NOT EXISTS evidence_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_evidence_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS previous_stage TEXT;

ALTER TABLE reward_events
  ADD COLUMN IF NOT EXISTS source_event_id UUID,
  ADD COLUMN IF NOT EXISTS intensity TEXT;

CREATE INDEX IF NOT EXISTS idx_reward_events_source_event_id ON reward_events(source_event_id);
