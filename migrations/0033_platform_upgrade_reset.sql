-- Platform upgrade: user reset tracking + archive store (reversible metadata)
ALTER TABLE users ADD COLUMN IF NOT EXISTS execution_state text NOT NULL DEFAULT 'NORMAL';
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_login_after_upgrade boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS platform_upgrade_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  payload jsonb NOT NULL,
  archived_by_upgrade boolean NOT NULL DEFAULT true,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_upgrade_archive_user_id ON platform_upgrade_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_upgrade_archive_entity_type ON platform_upgrade_archive(entity_type);

CREATE TABLE IF NOT EXISTS platform_upgrade_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  user_count integer NOT NULL DEFAULT 0,
  summary jsonb,
  rollback_available boolean NOT NULL DEFAULT true
);
