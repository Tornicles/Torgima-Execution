-- Migration 0040: Supabase auth → public.users profile sync
-- Safe to run multiple times (IF NOT EXISTS / OR REPLACE / guarded updates).
-- Run in Supabase SQL Editor or via db:apply-manual on deploy.
-- Forward-only: no drops of tables, no user deletion, no auth.users changes.

-- ── 1. Ensure enum types exist (idempotent) ───────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.user_mode AS ENUM ('individual', 'team');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_tier AS ENUM ('starter', 'growth', 'ultimate');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Add supabase_id column + unique index ────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS supabase_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS users_supabase_id_unique_idx
  ON public.users (supabase_id)
  WHERE supabase_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_supabase_id
  ON public.users (supabase_id)
  WHERE supabase_id IS NOT NULL;

-- ── 3. Ensure required profile columns exist (no data overwrite) ────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mode public.user_mode NOT NULL DEFAULT 'individual';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tier public.user_tier NOT NULL DEFAULT 'starter';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS execution_state TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_login_after_upgrade BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS civilization_context JSONB;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS communication_profile JSONB;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── 4. Sync function — new Supabase signups ───────────────────────────────
-- Preferred mapping: public.users.id = auth.users.id, supabase_id = auth.users.id
CREATE OR REPLACE FUNCTION public.handle_new_supabase_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(NEW.email));
BEGIN
  INSERT INTO public.users (
    id,
    email,
    supabase_id,
    mode,
    tier,
    onboarding_complete,
    active,
    execution_state,
    first_login_after_upgrade,
    timezone,
    metadata,
    notification_preferences,
    civilization_context,
    communication_profile,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_email,
    NEW.id,
    'individual'::public.user_mode,
    'starter'::public.user_tier,
    false,
    true,
    'NORMAL',
    false,
    'UTC',
    '{}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    supabase_id = EXCLUDED.supabase_id,
    updated_at  = NOW()
  WHERE public.users.supabase_id IS NULL;

  RETURN NEW;
END;
$$;

-- ── 5. Trigger on auth.users ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_supabase_user();

-- ── 6. Link existing public.users rows by email (preserve row data) ─────────
UPDATE public.users pu
SET supabase_id = au.id,
    updated_at  = NOW()
FROM auth.users au
WHERE lower(trim(pu.email)) = lower(trim(au.email))
  AND pu.supabase_id IS NULL;

-- ── 7. Backfill missing public.users from auth.users ────────────────────────
INSERT INTO public.users (
  id,
  email,
  supabase_id,
  mode,
  tier,
  onboarding_complete,
  active,
  execution_state,
  first_login_after_upgrade,
  timezone,
  metadata,
  notification_preferences,
  civilization_context,
  communication_profile,
  created_at,
  updated_at
)
SELECT
  au.id,
  lower(trim(au.email)),
  au.id,
  'individual'::public.user_mode,
  'starter'::public.user_tier,
  false,
  true,
  'NORMAL',
  false,
  'UTC',
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1
  FROM public.users pu
  WHERE pu.supabase_id = au.id
     OR lower(trim(pu.email)) = lower(trim(au.email))
)
ON CONFLICT (email) DO UPDATE SET
  supabase_id = EXCLUDED.supabase_id,
  updated_at  = NOW()
WHERE public.users.supabase_id IS NULL;
