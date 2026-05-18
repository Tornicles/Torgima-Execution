-- BHUDHI Prompt 8 — idempotency records, system health snapshots

CREATE TABLE IF NOT EXISTS idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  result JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_records_expires_at ON idempotency_records(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_records_key ON idempotency_records(key);

CREATE TABLE IF NOT EXISTS system_health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  health_score DOUBLE PRECISION NOT NULL,
  signal_engine_health DOUBLE PRECISION NOT NULL DEFAULT 1,
  condition_engine_health DOUBLE PRECISION NOT NULL DEFAULT 1,
  bhudhi_health DOUBLE PRECISION NOT NULL DEFAULT 1,
  db_health DOUBLE PRECISION NOT NULL DEFAULT 1,
  worker_health DOUBLE PRECISION NOT NULL DEFAULT 1,
  eis_health DOUBLE PRECISION NOT NULL DEFAULT 1,
  critical_alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  dlq_size INTEGER NOT NULL DEFAULT 0,
  pending_events INTEGER NOT NULL DEFAULT 0,
  stale_users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_health_records_created_at ON system_health_records(created_at DESC);

ALTER TABLE dead_letter_events
  ADD COLUMN IF NOT EXISTS requires_manual BOOLEAN NOT NULL DEFAULT false;
