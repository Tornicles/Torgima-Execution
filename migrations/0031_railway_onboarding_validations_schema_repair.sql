-- historical migration filename only — not an active Railway dependency
-- Drizzle-tracked mirror of manual-20260603-railway-onboarding-validations-schema-repair.sql
DO $$ BEGIN
  CREATE TYPE "validation_kind" AS ENUM (
    'legacy', 'intelligence', 'erector', 'readiness', 'path_selection', 'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "validation_readiness" AS ENUM (
    'not_ready', 'partial', 'ready_proceed', 'ready_with_adjustment', 'blocked_pivot', 'blocked_reality'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "selected_path" AS ENUM ('current', 'adjusted', 'alternative');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "contract_id" uuid DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "validation_kind" "validation_kind" DEFAULT 'unknown';
--> statement-breakpoint
ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "payload_version" integer DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "intelligence_payload" jsonb;
--> statement-breakpoint
ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "blueprint_contract" jsonb;
--> statement-breakpoint
ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "launch_blocked" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "readiness" "validation_readiness";
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "raw_goal_input" text;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "raw_purpose_input" text;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "goal_final" text;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "purpose_final" text;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "raw_goal" text;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "domain" text;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "tier" "user_tier";
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "mode" "user_mode" DEFAULT 'individual';
