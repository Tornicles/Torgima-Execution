-- Supabase Row Level Security (apply when using Supabase Auth + direct client access)
-- Backend service_role bypasses RLS. Run only on Supabase-hosted Postgres.

ALTER TABLE IF EXISTS blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS signal_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS actions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Skip on non-Supabase Postgres (local CI DB doesn't have auth.uid()).
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own blueprints' AND tablename = 'blueprints'
  ) THEN
    CREATE POLICY "Users see own blueprints" ON blueprints
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own orders' AND tablename = 'orders'
  ) THEN
    CREATE POLICY "Users see own orders" ON orders
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own feedback' AND tablename = 'feedback'
  ) THEN
    CREATE POLICY "Users see own feedback" ON feedback
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own validations' AND tablename = 'validations'
  ) THEN
    CREATE POLICY "Users see own validations" ON validations
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
