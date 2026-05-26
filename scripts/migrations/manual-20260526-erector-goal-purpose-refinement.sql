-- Erector Goal + Purpose Refinement + Validation Workspace
ALTER TABLE validations ADD COLUMN IF NOT EXISTS raw_purpose TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS goal_options JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS goal_understanding JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_goal_option INTEGER;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS goal_final TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS purpose_options JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS purpose_understanding JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_purpose_option INTEGER;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS purpose_final TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS refinement_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_feed JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_sections JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_final JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_workspace_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_original_snapshot JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS economic_type TEXT;

ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS raw_purpose TEXT;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS goal_final TEXT;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS purpose_final TEXT;
