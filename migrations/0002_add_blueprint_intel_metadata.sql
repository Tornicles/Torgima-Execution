ALTER TABLE "blueprints"
  ADD COLUMN IF NOT EXISTS "intel_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb;