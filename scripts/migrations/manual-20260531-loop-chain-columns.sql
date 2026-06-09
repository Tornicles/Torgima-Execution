-- Continuous execution loop: idempotent column backfill (safe on Supabase).
-- Most columns already exist in lib/db schema; this fills gaps on older databases.

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS weighted_score DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difficulty_felt TEXT,
  ADD COLUMN IF NOT EXISTS interrogation_json JSONB;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS why_it_matters TEXT,
  ADD COLUMN IF NOT EXISTS enforcement_package_id UUID,
  ADD COLUMN IF NOT EXISTS generation_mode TEXT,
  ADD COLUMN IF NOT EXISTS value_score DOUBLE PRECISION DEFAULT 5,
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE signal_snapshots
  ADD COLUMN IF NOT EXISTS data_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trend TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS trigger_feedback_id UUID;

ALTER TABLE state_memory
  ADD COLUMN IF NOT EXISTS exited_at TIMESTAMPTZ;

ALTER TABLE task_generation_log
  ADD COLUMN IF NOT EXISTS bhudhi_used BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tasks_generated INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS enforcement_package_id UUID;
