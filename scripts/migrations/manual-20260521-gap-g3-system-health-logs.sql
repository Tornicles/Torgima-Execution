-- GAP G3 — extend system_health_logs for DOC_17 integrity monitoring

ALTER TABLE system_health_logs
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_system_health_logs_severity
  ON system_health_logs(severity)
  WHERE severity IN ('CRITICAL', 'FATAL');

CREATE INDEX IF NOT EXISTS idx_system_health_logs_area
  ON system_health_logs(area);
