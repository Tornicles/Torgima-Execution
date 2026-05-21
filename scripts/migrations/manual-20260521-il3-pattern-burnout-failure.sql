-- IL3 — pattern learning, burnout signals, failure classification on feedback (DOC_21 / DOC_22)

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS failure_classification TEXT,
  ADD COLUMN IF NOT EXISTS failure_correction_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'behavior_pattern_type' AND e.enumlabel = 'difficulty_ceiling'
  ) THEN
    ALTER TYPE behavior_pattern_type ADD VALUE 'difficulty_ceiling';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'behavior_pattern_type' AND e.enumlabel = 'task_type_avoidance'
  ) THEN
    ALTER TYPE behavior_pattern_type ADD VALUE 'task_type_avoidance';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'behavior_pattern_type' AND e.enumlabel = 'recovery_dependence'
  ) THEN
    ALTER TYPE behavior_pattern_type ADD VALUE 'recovery_dependence';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'behavior_pattern_type' AND e.enumlabel = 'false_progress'
  ) THEN
    ALTER TYPE behavior_pattern_type ADD VALUE 'false_progress';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'behavior_pattern_type' AND e.enumlabel = 'focus_drift'
  ) THEN
    ALTER TYPE behavior_pattern_type ADD VALUE 'focus_drift';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_feedback_failure_classification
  ON feedback(blueprint_id, failure_classification)
  WHERE failure_classification IS NOT NULL;
