-- PROMPT 2 Stage 5 — study sessions (calendar blocks)

CREATE TABLE IF NOT EXISTS academy_study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learning_goal_id UUID REFERENCES academy_learning_goals(id) ON DELETE SET NULL,
  schedule_id UUID REFERENCES academy_study_schedules(id) ON DELETE SET NULL,
  session_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 45,
  synced_to_calendar BOOLEAN NOT NULL DEFAULT false,
  calendar_block_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academy_study_sessions_user_date ON academy_study_sessions(user_id, session_date);
