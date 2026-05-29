-- Drizzle-tracked mirror of manual-20260602-blueprint-raw-goal-purpose-input.sql
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "raw_goal_input" text;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "raw_purpose_input" text;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "goal_options" jsonb;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "selected_goal_index" integer;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "purpose_options" jsonb;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "selected_purpose_index" integer;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "refinement_status" text;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "economic_type" text;
