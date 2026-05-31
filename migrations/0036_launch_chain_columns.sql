-- Launch chain: optional columns referenced by initial task generation (idempotent)
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS launched_at timestamptz;
--> statement-breakpoint
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS data_points integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS trend text DEFAULT 'stable';
--> statement-breakpoint
ALTER TABLE task_generation_log ADD COLUMN IF NOT EXISTS ai_used boolean DEFAULT false;
