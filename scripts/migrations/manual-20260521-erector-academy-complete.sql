-- PROMPT 2 — Erector Academy complete system (Stages 1–3 core tables)

CREATE TABLE IF NOT EXISTS academy_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty_level TEXT NOT NULL DEFAULT 'beginner',
  estimated_duration_hours INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academy_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES academy_courses(id) ON DELETE CASCADE,
  chapter_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  learning_objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_duration_minutes INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, chapter_number)
);

CREATE TABLE IF NOT EXISTS academy_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES academy_chapters(id) ON DELETE CASCADE,
  lesson_number INT NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  content_body TEXT NOT NULL,
  key_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  reading_time_minutes INT NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chapter_id, lesson_number)
);

CREATE TABLE IF NOT EXISTS academy_practice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'quiz',
  difficulty INT NOT NULL DEFAULT 2 CHECK (difficulty >= 1 AND difficulty <= 5),
  question_text TEXT NOT NULL,
  answer_options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academy_practice_items_lesson ON academy_practice_items(lesson_id);

CREATE TABLE IF NOT EXISTS academy_student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES academy_courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'enrolled',
  progress_percent INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS academy_student_learning_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  learning_style TEXT NOT NULL DEFAULT 'reading',
  pace TEXT NOT NULL DEFAULT 'normal',
  preferred_formats JSONB NOT NULL DEFAULT '["text"]'::jsonb,
  comprehension_speed DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  retention_rate DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  common_mistakes JSONB NOT NULL DEFAULT '[]'::jsonb,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academy_lesson_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  time_spent_seconds INT,
  score DOUBLE PRECISION,
  passed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academy_practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_item_id UUID NOT NULL REFERENCES academy_practice_items(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_answer TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  time_taken_seconds INT,
  is_retry BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS academy_concept_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL,
  mastery_level DOUBLE PRECISION NOT NULL DEFAULT 0,
  first_attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_attempts INT NOT NULL DEFAULT 0,
  successful_attempts INT NOT NULL DEFAULT 0,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, concept_id)
);

CREATE TABLE IF NOT EXISTS academy_learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL,
  pattern_description TEXT NOT NULL,
  frequency INT NOT NULL DEFAULT 1,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actionable_insight TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academy_retention_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  learned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recalled_correctly INT NOT NULL DEFAULT 0,
  recalled_incorrectly INT NOT NULL DEFAULT 0,
  retention_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  forgetting_curve DOUBLE PRECISION,
  next_review_date TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS academy_learning_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_title TEXT NOT NULL,
  target_skill TEXT NOT NULL,
  target_mastery_level INT NOT NULL DEFAULT 80,
  deadline TEXT,
  aligned_with_blueprint_id UUID REFERENCES blueprints(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academy_study_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learning_goal_id UUID NOT NULL REFERENCES academy_learning_goals(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL DEFAULT 'weekly',
  sessions_per_week INT NOT NULL DEFAULT 3,
  minutes_per_session INT NOT NULL DEFAULT 45,
  start_date TEXT,
  end_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academy_roadmap_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learning_goal_id UUID NOT NULL REFERENCES academy_learning_goals(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  course_id UUID REFERENCES academy_courses(id) ON DELETE SET NULL,
  estimated_duration_days INT NOT NULL DEFAULT 7,
  prerequisite_step_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'not-started',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (learning_goal_id, step_number)
);

CREATE TABLE IF NOT EXISTS academy_generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  topic TEXT NOT NULL,
  generated_content TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
