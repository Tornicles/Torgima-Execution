-- IL2 / R6 — align live DB with Drizzle `false_progress_flags.detection_type`

ALTER TABLE false_progress_flags
  ADD COLUMN IF NOT EXISTS detection_type TEXT;

UPDATE false_progress_flags
SET detection_type = COALESCE(
  detection_type,
  (evidence_json->>'pattern')::text,
  'activity_without_outcome'
)
WHERE detection_type IS NULL;

ALTER TABLE false_progress_flags
  ALTER COLUMN detection_type SET DEFAULT 'activity_without_outcome';

ALTER TABLE false_progress_flags
  ALTER COLUMN detection_type SET NOT NULL;
