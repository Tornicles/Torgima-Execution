-- Erector execution bridge columns (Prompt 4 / audit alignment)
ALTER TYPE "task_type" ADD VALUE IF NOT EXISTS 'smoke_test';
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "blueprint_tier" text;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "industry_state" text;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "archetype_execution_mult" double precision;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "archetype_timeframe_mult" double precision;
--> statement-breakpoint
ALTER TABLE "blueprints" ADD COLUMN IF NOT EXISTS "archetype_difficulty_adj" double precision;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feedback_blueprint_created_at" ON "feedback" USING btree ("blueprint_id","created_at");
