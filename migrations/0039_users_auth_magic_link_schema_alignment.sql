-- Idempotent auth schema alignment for POST /api/auth/send-magic-link (DOC 30).
-- Forward-only: no drops, no renames, safe to run multiple times.

DO $$ BEGIN
  CREATE TYPE user_mode AS ENUM ('individual', 'team');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_tier AS ENUM ('starter', 'growth', 'ultimate');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE commitment_level AS ENUM ('low', 'medium', 'high', 'full');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mode user_mode NOT NULL DEFAULT 'individual';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier user_tier NOT NULL DEFAULT 'starter';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_context TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS domain_hint TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commitment_level commitment_level;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS execution_state TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_login_after_upgrade BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_blueprint_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS civilization_context JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS communication_profile JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"email_inactivity_reminder":true,"email_milestone_achieved":true,"email_blueprint_completed":true,"email_pivot_review_ready":true,"email_blueprint_paused":true,"email_weekly_summary":false,"email_all_disabled":false,"quiet_hours_enabled":false,"quiet_hours_start":"22:00","quiet_hours_end":"08:00"}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_unique ON sessions(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_unique ON sessions(token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS used BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS magic_link_tokens_token_unique ON magic_link_tokens(token);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_user_id ON magic_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email ON magic_link_tokens(email);
