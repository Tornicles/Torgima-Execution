-- PROMPT 8 — Integrations ecosystem (calendar, health, notifications, social, webhooks)

CREATE TABLE IF NOT EXISTS external_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  oauth_token_encrypted TEXT,
  oauth_refresh_token_encrypted TEXT,
  oauth_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  account_identifier TEXT,
  last_sync_time TIMESTAMPTZ,
  last_sync_status TEXT NOT NULL DEFAULT 'pending',
  last_sync_error TEXT,
  sync_frequency TEXT NOT NULL DEFAULT 'hourly',
  enabled BOOLEAN NOT NULL DEFAULT true,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, integration_type)
);

CREATE TABLE IF NOT EXISTS calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES external_integrations(id) ON DELETE CASCADE,
  sync_direction TEXT NOT NULL,
  events_synced INT NOT NULL DEFAULT 0,
  events_created INT NOT NULL DEFAULT 0,
  events_updated INT NOT NULL DEFAULT 0,
  events_deleted INT NOT NULL DEFAULT 0,
  sync_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'success',
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_data_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES external_integrations(id) ON DELETE SET NULL,
  metric_type TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  source_date DATE NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_conflicts_external (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  torgima_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  external_event_id TEXT NOT NULL,
  external_calendar TEXT NOT NULL,
  conflict_type TEXT NOT NULL DEFAULT 'time-overlap',
  resolution_strategy TEXT NOT NULL DEFAULT 'manual',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_post_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  published_content_id UUID REFERENCES published_content(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  external_post_id TEXT,
  external_post_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engagement_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_post_mapping_id UUID NOT NULL REFERENCES social_post_mappings(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  likes INT NOT NULL DEFAULT 0,
  comments INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  views INT NOT NULL DEFAULT 0,
  impressions INT NOT NULL DEFAULT 0,
  reach INT NOT NULL DEFAULT 0,
  engagement_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  event_type TEXT NOT NULL,
  secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES integration_webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  response_status INT,
  response_body TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger TEXT NOT NULL,
  trigger_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zapier_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zapier_id TEXT NOT NULL,
  integration_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, zapier_id)
);

CREATE INDEX IF NOT EXISTS idx_external_integrations_user ON external_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_integration ON calendar_sync_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_user_event ON integration_webhooks(user_id, event_type);
