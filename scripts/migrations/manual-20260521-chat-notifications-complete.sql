-- PROMPT 4 — Personal chat & multi-channel notifications

CREATE TABLE IF NOT EXISTS personal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  voice_url TEXT,
  voice_duration_seconds INT,
  voice_transcription TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  linked_principle_id UUID,
  sentiment TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_blocker BOOLEAN NOT NULL DEFAULT false,
  blocker_type TEXT,
  blocker_severity INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_messages_user_created ON personal_messages(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES personal_messages(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES personal_messages(id) ON DELETE CASCADE,
  searchable_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_search_user ON message_search_index(user_id);

CREATE TABLE IF NOT EXISTS blocker_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES personal_messages(id) ON DELETE CASCADE,
  blocker_type TEXT NOT NULL,
  severity INT NOT NULL DEFAULT 3,
  description TEXT NOT NULL,
  related_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  resolution_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocker_logs_user_status ON blocker_logs(user_id, status);

CREATE TABLE IF NOT EXISTS chat_voice_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES personal_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audio_file_url TEXT NOT NULL,
  duration_seconds INT NOT NULL,
  transcription TEXT,
  transcription_confidence DOUBLE PRECISION,
  transcribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS status_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  energy INT NOT NULL,
  clarity INT NOT NULL,
  momentum INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  oauth_token_encrypted TEXT,
  oauth_refresh_token_encrypted TEXT,
  channel_identifier TEXT,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, channel_type)
);

CREATE TABLE IF NOT EXISTS channel_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 3,
  delivery_time_window_start TEXT,
  delivery_time_window_end TEXT,
  batch_frequency TEXT NOT NULL DEFAULT 'immediate',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, channel_type, notification_type)
);

CREATE TABLE IF NOT EXISTS notification_delivery_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 3,
  channels_to_send JSONB NOT NULL DEFAULT '[]'::jsonb,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_queue_due ON notification_delivery_queue(scheduled_for) WHERE sent_at IS NULL;

CREATE TABLE IF NOT EXISTS notification_delivery_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  queue_id UUID REFERENCES notification_delivery_queue(id) ON DELETE SET NULL,
  channel_type TEXT NOT NULL,
  status TEXT NOT NULL,
  delivery_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS do_not_disturb_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL DEFAULT '22:00',
  end_time TEXT NOT NULL DEFAULT '07:00',
  days_of_week JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 3,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_unread ON in_app_notifications(user_id) WHERE read_at IS NULL;
