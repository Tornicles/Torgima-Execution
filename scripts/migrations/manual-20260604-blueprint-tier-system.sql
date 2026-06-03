-- Blueprint Tier System: tier preview + generation log + validation/blueprint extensions

DO $$ BEGIN
  CREATE TYPE validation_tier_flow_status AS ENUM (
    'pending',
    'scored',
    'tier_presented',
    'tier_selected',
    'launched'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE blueprint_status ADD VALUE IF NOT EXISTS 'generating';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE validations
  ADD COLUMN IF NOT EXISTS tier_flow_status validation_tier_flow_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS tier_presented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tier_selected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tier_preview_data JSONB;

ALTER TABLE blueprints
  ADD COLUMN IF NOT EXISTS generation_depth INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tier_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS policy_enforcement TEXT NOT NULL DEFAULT 'display_only',
  ADD COLUMN IF NOT EXISTS signal_mode TEXT NOT NULL DEFAULT 'simplified',
  ADD COLUMN IF NOT EXISTS adaptation_mode TEXT NOT NULL DEFAULT 'none';

CREATE TABLE IF NOT EXISTS blueprint_tier_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id UUID NOT NULL REFERENCES validations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier user_tier NOT NULL,
  headline TEXT NOT NULL,
  description TEXT NOT NULL,
  plan_count INTEGER NOT NULL,
  target_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  signal_system TEXT NOT NULL,
  task_style TEXT NOT NULL,
  ai_depth TEXT NOT NULL,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  growth_projection JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended BOOLEAN NOT NULL DEFAULT false,
  recommendation_reason TEXT,
  selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_tier_previews_validation_id
  ON blueprint_tier_previews(validation_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_tier_previews_user_id
  ON blueprint_tier_previews(user_id);

CREATE TABLE IF NOT EXISTS blueprint_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  validation_id UUID NOT NULL REFERENCES validations(id) ON DELETE CASCADE,
  tier user_tier NOT NULL,
  generation_trigger TEXT NOT NULL DEFAULT 'tier_selected',
  layers_generated JSONB NOT NULL DEFAULT '{}'::jsonb,
  plans_created INTEGER NOT NULL DEFAULT 0,
  seasons_created INTEGER NOT NULL DEFAULT 0,
  targets_created INTEGER NOT NULL DEFAULT 0,
  phases_created INTEGER NOT NULL DEFAULT 0,
  projects_created INTEGER NOT NULL DEFAULT 0,
  actions_created INTEGER NOT NULL DEFAULT 0,
  bhudhi_used BOOLEAN NOT NULL DEFAULT false,
  bhudhi_log_id UUID REFERENCES bhudhi_logs(id) ON DELETE SET NULL,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  fallback_reason TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'complete',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_generation_log_blueprint_id
  ON blueprint_generation_log(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_generation_log_user_id
  ON blueprint_generation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_generation_log_validation_id
  ON blueprint_generation_log(validation_id);
