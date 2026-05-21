-- PROMPT 3 — Torgima native calendar (Stages 1–2)

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_id UUID,
  source_type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,
  priority INT NOT NULL DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  location TEXT,
  location_coordinates JSONB,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_id, source_type)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_start ON calendar_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_status ON calendar_events(user_id, status);

CREATE TABLE IF NOT EXISTS calendar_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL DEFAULT 'in-app',
  trigger_minutes_before INT NOT NULL,
  scheduled_send_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_notifications_due ON calendar_notifications(scheduled_send_at) WHERE sent_at IS NULL;

CREATE TABLE IF NOT EXISTS calendar_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_1_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  event_2_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_conflicts_user_unresolved ON calendar_conflicts(user_id) WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS calendar_views_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  default_view TEXT NOT NULL DEFAULT 'calendar',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  color_coding TEXT NOT NULL DEFAULT 'by-type',
  time_zone TEXT NOT NULL DEFAULT 'UTC',
  week_start_day INT NOT NULL DEFAULT 1,
  show_weekends BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_time_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_pattern TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_time_blocks_user ON calendar_time_blocks(user_id, start_time);
