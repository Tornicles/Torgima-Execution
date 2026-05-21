-- PROMPT 1 — 365 Principles complete system (Stages 1–4)

CREATE TABLE IF NOT EXISTS principles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number INT NOT NULL UNIQUE CHECK (day_number >= 1 AND day_number <= 365),
  principle_statement TEXT NOT NULL,
  principle_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  philosophy TEXT NOT NULL,
  tension_points TEXT NOT NULL,
  management_volume_source TEXT,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS principle_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  principle_id UUID NOT NULL REFERENCES principles(id) ON DELETE CASCADE,
  selected_date TEXT NOT NULL,
  selection_reason TEXT NOT NULL,
  signal_state TEXT,
  execution_blocker TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, selected_date)
);

CREATE TABLE IF NOT EXISTS principle_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  principle_id UUID NOT NULL REFERENCES principles(id) ON DELETE CASCADE,
  principle_date TEXT NOT NULL,
  proof_type TEXT NOT NULL,
  proof_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  application_description TEXT NOT NULL,
  linked_order_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  public_visible BOOLEAN NOT NULL DEFAULT true,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, principle_date)
);

CREATE TABLE IF NOT EXISTS principle_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  last_applied_date TEXT,
  streak_frozen_month TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS principle_proof_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES principle_applications(id) ON DELETE CASCADE,
  file_url TEXT,
  file_type TEXT,
  file_size INT,
  duration_seconds INT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_guidance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  principle_id UUID NOT NULL REFERENCES principles(id) ON DELETE CASCADE,
  guidance_date TEXT NOT NULL,
  recommended_platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_format TEXT NOT NULL,
  content_angle TEXT NOT NULL,
  trending_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  platform_trends JSONB NOT NULL DEFAULT '{}'::jsonb,
  research_prompts TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, guidance_date)
);

CREATE TABLE IF NOT EXISTS user_social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_id TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, platform)
);

CREATE TABLE IF NOT EXISTS published_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  principle_id UUID REFERENCES principles(id) ON DELETE SET NULL,
  content_date TEXT NOT NULL,
  platforms_posted JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_text TEXT NOT NULL,
  content_url TEXT,
  engagement JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_engagement_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_principle_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  bio TEXT,
  profile_public BOOLEAN NOT NULL DEFAULT false,
  profile_url_slug TEXT NOT NULL UNIQUE,
  privacy_setting TEXT NOT NULL DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_principle_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  principle_date TEXT NOT NULL,
  principle_id UUID NOT NULL REFERENCES principles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES principle_applications(id) ON DELETE SET NULL,
  published_content_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  engagement_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  public_visible BOOLEAN NOT NULL DEFAULT true,
  reflection TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, principle_date)
);

CREATE INDEX IF NOT EXISTS idx_principle_selections_user_date ON principle_selections(user_id, selected_date DESC);
CREATE INDEX IF NOT EXISTS idx_principle_applications_user_date ON principle_applications(user_id, principle_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_principle_records_user_date ON daily_principle_records(user_id, principle_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_principle_profiles_slug ON user_principle_profiles(profile_url_slug);
