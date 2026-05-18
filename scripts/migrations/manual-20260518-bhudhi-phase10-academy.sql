-- BHUDHI Prompt 10 — Academy system tables

CREATE TABLE IF NOT EXISTS skill_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL DEFAULT 'Content',
  skill_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  mastered_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_assessment TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_profiles_user_id ON skill_profiles(user_id);

CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE SET NULL,
  skill_gap TEXT NOT NULL,
  domain TEXT NOT NULL,
  path_status TEXT NOT NULL DEFAULT 'ACTIVE',
  lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_lessons INTEGER NOT NULL DEFAULT 0,
  completed_lessons INTEGER NOT NULL DEFAULT 0,
  mastery_score DOUBLE PRECISION,
  mastery_evidence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_learning_paths_user_status ON learning_paths(user_id, path_status);

CREATE TABLE IF NOT EXISTS capability_gap_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  gap_type TEXT NOT NULL,
  detected_from TEXT NOT NULL DEFAULT 'FAILURE_CLASSIFICATION',
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  learning_path_id UUID REFERENCES learning_paths(id) ON DELETE SET NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capability_gap_logs_user_resolved ON capability_gap_logs(user_id, resolved);

ALTER TABLE academy_tasks
  ADD COLUMN IF NOT EXISTS learning_path_id UUID REFERENCES learning_paths(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skill_category TEXT,
  ADD COLUMN IF NOT EXISTS lesson_number INTEGER,
  ADD COLUMN IF NOT EXISTS lesson_objective TEXT,
  ADD COLUMN IF NOT EXISTS mastery_definition TEXT,
  ADD COLUMN IF NOT EXISTS practice_type TEXT,
  ADD COLUMN IF NOT EXISTS completion_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS skill_delta DOUBLE PRECISION;
