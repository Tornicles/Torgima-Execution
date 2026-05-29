-- Drizzle-tracked mirror of manual-20260529-full-schema-alignment.sql (subset)
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "blueprint_tier" text;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "primary_archetype_id" uuid;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "reality_score" double precision;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "current_condition" text;
--> statement-breakpoint
ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "path_current" jsonb;
--> statement-breakpoint
ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "path_adjusted" jsonb;
--> statement-breakpoint
ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "path_alternative" jsonb;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "condition_at_generation" text;
