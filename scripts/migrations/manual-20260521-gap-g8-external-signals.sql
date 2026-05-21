-- GAP G8 — external signal integration (append-only audit trail)

CREATE TABLE IF NOT EXISTS external_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  trust_level TEXT NOT NULL DEFAULT 'UNTRUSTED',
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  signal_type TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_external_signals_user_id ON external_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_external_signals_blueprint_id ON external_signals(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_external_signals_source_name ON external_signals(source_name);
CREATE INDEX IF NOT EXISTS idx_external_signals_status ON external_signals(status);
