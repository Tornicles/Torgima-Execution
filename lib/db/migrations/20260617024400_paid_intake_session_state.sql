-- PROMPT 6 — Paid Project Intelligence Intake session extensions
-- Additive, safe, idempotent.

ALTER TABLE erector_intake_sessions
  ADD COLUMN IF NOT EXISTS section_9_data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS completion_percentage integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS required_missing_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS prefill_source_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS baseline_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS baseline_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS baseline_failed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_intake_sessions_blueprint_id ON erector_intake_sessions(blueprint_id);

