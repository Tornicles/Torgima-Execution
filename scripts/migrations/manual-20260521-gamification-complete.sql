-- PROMPT 5 — Gamification (XP, levels, streaks, achievements, avatar)

CREATE TABLE IF NOT EXISTS user_gamification_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_level INT NOT NULL DEFAULT 1,
  total_xp INT NOT NULL DEFAULT 0,
  xp_to_next_level INT NOT NULL DEFAULT 100,
  avatar_id UUID,
  avatar_customization JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_achievements INT NOT NULL DEFAULT 0,
  total_rewards_earned INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  xp_amount INT NOT NULL,
  xp_source TEXT NOT NULL,
  source_id TEXT,
  multiplier_applied DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_ledger_user_earned ON xp_ledger(user_id, earned_at DESC);

CREATE TABLE IF NOT EXISTS user_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level_number INT NOT NULL,
  xp_required_total INT NOT NULL,
  milestone_description TEXT,
  reached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, level_number)
);

CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  streak_type TEXT NOT NULL,
  current_count INT NOT NULL DEFAULT 0,
  best_count INT NOT NULL DEFAULT 0,
  last_activity_date DATE,
  frozen_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, streak_type)
);

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  trigger_condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  xp_reward INT NOT NULL DEFAULT 0,
  rarity TEXT NOT NULL DEFAULT 'common',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  display_on_profile BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS avatar_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_name TEXT NOT NULL,
  base_asset_url TEXT,
  customization_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  evolution_level INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_avatar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_avatar_template_id UUID REFERENCES avatar_templates(id) ON DELETE SET NULL,
  color TEXT NOT NULL DEFAULT 'violet',
  accessories JSONB NOT NULL DEFAULT '[]'::jsonb,
  pose TEXT NOT NULL DEFAULT 'standing',
  customized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id TEXT NOT NULL UNIQUE,
  reward_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  unlock_requirement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  display_on_profile BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, reward_id)
);

CREATE TABLE IF NOT EXISTS level_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level INT NOT NULL UNIQUE,
  xp_required_total INT NOT NULL,
  milestone_title TEXT,
  milestone_description TEXT,
  avatar_evolution_unlocked BOOLEAN NOT NULL DEFAULT false,
  new_cosmetics_available JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
