-- GAP G5 — DOC_11 inactivity record fields

ALTER TABLE inactivity_records
  ADD COLUMN IF NOT EXISTS inactivity_type TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT,
  ADD COLUMN IF NOT EXISTS last_feedback_at TIMESTAMPTZ;
