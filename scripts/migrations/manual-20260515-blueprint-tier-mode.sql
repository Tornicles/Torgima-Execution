-- Master blueprint tier/mode architecture alignment

DO $$ BEGIN
  ALTER TYPE blueprint_status ADD VALUE IF NOT EXISTS 'awaiting_selection' AFTER 'validating';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE intelligence_depth AS ENUM ('guided', 'operational', 'strategic');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE blueprints
  ADD COLUMN IF NOT EXISTS tier user_tier,
  ADD COLUMN IF NOT EXISTS intelligence_depth intelligence_depth,
  ADD COLUMN IF NOT EXISTS selection_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blueprint_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE targets
  ADD COLUMN IF NOT EXISTS contributor_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS role_domain TEXT,
  ADD COLUMN IF NOT EXISTS trace_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE phases
  ADD COLUMN IF NOT EXISTS trace_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS assignee_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trace_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS trace_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS assigned_member_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trace_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
