-- Manual mirror: migrations/0036_launch_chain_columns.sql
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS launched_at timestamptz;
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS data_points integer DEFAULT 0;
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS trend text DEFAULT 'stable';
ALTER TABLE task_generation_log ADD COLUMN IF NOT EXISTS ai_used boolean DEFAULT false;
