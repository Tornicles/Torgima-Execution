-- historical migration filename only — not an active Railway dependency
-- Validation launch + results columns (idempotent production repair)
ALTER TABLE validations ADD COLUMN IF NOT EXISTS is_finalized boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS handoff_package jsonb;
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_path text;
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_path_type text;
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_version integer DEFAULT 1;
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS launch_blocked boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS readiness text;
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS contract_id uuid DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS intelligence_payload jsonb;
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS blueprint_contract jsonb;
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS paths jsonb;
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS verdict text;
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS reality_result jsonb;
--> statement-breakpoint
ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_direction jsonb;
--> statement-breakpoint
UPDATE validations SET contract_id = gen_random_uuid() WHERE contract_id IS NULL;
--> statement-breakpoint
UPDATE validations SET is_finalized = false WHERE is_finalized IS NULL;
--> statement-breakpoint
UPDATE validations SET launch_blocked = false WHERE launch_blocked IS NULL;
--> statement-breakpoint
UPDATE validations SET validation_version = 1 WHERE validation_version IS NULL;
