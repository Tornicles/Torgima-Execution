-- Phase 4: waitlist + hot-query indexes (idempotent)

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  source TEXT DEFAULT 'website',
  goal TEXT,
  invited BOOLEAN DEFAULT false,
  invited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_invited ON waitlist(invited);

CREATE INDEX IF NOT EXISTS idx_blueprints_user_active
  ON blueprints(user_id, active)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_orders_blueprint_status
  ON orders(blueprint_id, status)
  WHERE status IN ('pending', 'active', 'queued');

CREATE INDEX IF NOT EXISTS idx_sessions_token
  ON sessions(token);

CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_token
  ON magic_link_tokens(token)
  WHERE used = false;

CREATE INDEX IF NOT EXISTS idx_events_status_created
  ON events(status, created_at)
  WHERE status = 'pending';
