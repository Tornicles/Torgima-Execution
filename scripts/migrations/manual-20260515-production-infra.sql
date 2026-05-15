-- Prompt 8: production infrastructure tables + DLQ columns

ALTER TABLE dead_letter_events
  ADD COLUMN IF NOT EXISTS failure_class TEXT NOT NULL DEFAULT 'transient',
  ADD COLUMN IF NOT EXISTS resolution_status TEXT NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS validation_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id UUID NOT NULL REFERENCES validations(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  confidence INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_event_logs_validation_id ON validation_event_logs(validation_id);

CREATE TABLE IF NOT EXISTS verdict_evolution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id UUID NOT NULL REFERENCES validations(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_verdict TEXT,
  new_verdict TEXT NOT NULL,
  change_summary TEXT,
  improved BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eis_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  industry TEXT NOT NULL,
  niche TEXT NOT NULL,
  last_call_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cached_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eis_rate_limits_user_industry ON eis_rate_limits(user_id, industry, niche);

CREATE TABLE IF NOT EXISTS eis_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES blueprints(id),
  validation_id UUID REFERENCES validations(id),
  industry TEXT,
  niche TEXT,
  tokens_used INTEGER,
  estimated_cost_usd DOUBLE PRECISION,
  model_used TEXT,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  low_confidence BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eis_call_logs_created_at ON eis_call_logs(created_at);
