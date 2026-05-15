-- Blueprint infrastructure hardening (tier/mode + team + operational state)
-- Run after manual-20260515-blueprint-tier-mode.sql

DO $$ BEGIN
  CREATE TYPE team_role AS ENUM ('owner', 'strategist', 'operator', 'contributor', 'reviewer', 'observer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE blueprint_operational_state AS ENUM ('ACTIVE', 'STALLED', 'DEGRADED', 'RECOVERY', 'COLLAPSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE blueprints
  ADD COLUMN IF NOT EXISTS operational_state blueprint_operational_state DEFAULT 'ACTIVE';

CREATE TABLE IF NOT EXISTS blueprint_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'contributor',
  domain TEXT,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blueprint_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_blueprint_members_blueprint_id ON blueprint_members(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_members_user_id ON blueprint_members(user_id);

CREATE TABLE IF NOT EXISTS blueprint_tier_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_tier user_tier NOT NULL,
  to_tier user_tier NOT NULL,
  unlocked_systems JSONB NOT NULL DEFAULT '[]'::jsonb,
  migration_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_tier_migrations_blueprint_id ON blueprint_tier_migrations(blueprint_id);
