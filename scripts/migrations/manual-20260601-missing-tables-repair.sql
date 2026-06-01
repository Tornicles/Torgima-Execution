-- Repair bhudhi_signals (referenced before manual-20260528-structured-feedback ALTERs) and order_status.queued.

CREATE TABLE IF NOT EXISTS bhudhi_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  global_signal text NOT NULL DEFAULT 'stable',
  global_signal_confidence double precision NOT NULL DEFAULT 0.5,
  framework_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhudhi_signals_blueprint_id ON bhudhi_signals(blueprint_id);

ALTER TABLE bhudhi_signals ADD COLUMN IF NOT EXISTS execution_score double precision;
ALTER TABLE bhudhi_signals ADD COLUMN IF NOT EXISTS momentum double precision;
ALTER TABLE bhudhi_signals ADD COLUMN IF NOT EXISTS feedback_confidence double precision;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'queued';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
