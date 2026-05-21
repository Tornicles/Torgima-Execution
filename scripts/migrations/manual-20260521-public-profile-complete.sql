-- PROMPT 9 — Public profile & accountability (extends user_principle_profiles)

ALTER TABLE user_principle_profiles
  ADD COLUMN IF NOT EXISTS show_execution_level BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_avatar BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_achievements BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_principle_record BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_streak BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_activity BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public_profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer_source TEXT NOT NULL DEFAULT 'direct',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shareable_daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  principle_id UUID REFERENCES principles(id) ON DELETE SET NULL,
  daily_record_id UUID REFERENCES daily_principle_records(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT true,
  view_count INT NOT NULL DEFAULT 0,
  reaction_count INT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, entry_date)
);

CREATE TABLE IF NOT EXISTS profile_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  embed_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, widget_type)
);

CREATE TABLE IF NOT EXISTS accountability_pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pledge_text TEXT NOT NULL,
  deadline DATE NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_public_profile_views_user ON public_profile_views(user_id);
CREATE INDEX IF NOT EXISTS idx_shareable_daily_entries_token ON shareable_daily_entries(share_token);
