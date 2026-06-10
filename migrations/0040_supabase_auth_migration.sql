-- Migration 0040: Add supabase_id to public.users + trigger to sync auth.users → public.users
-- Safe to run multiple times (all statements use IF NOT EXISTS / OR REPLACE / ON CONFLICT).
-- Run this in Supabase SQL Editor when the database restriction is lifted.

-- 1. Add supabase_id column (links public.users to auth.users)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS supabase_id UUID UNIQUE;

-- 2. Index for fast lookup by supabase_id
CREATE INDEX IF NOT EXISTS idx_users_supabase_id
  ON public.users (supabase_id)
  WHERE supabase_id IS NOT NULL;

-- 3. Sync function — runs whenever a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_supabase_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (email, supabase_id, mode, tier, onboarding_complete, active, created_at, updated_at)
  VALUES (
    NEW.email,
    NEW.id,
    'individual',
    'starter',
    false,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    supabase_id  = EXCLUDED.supabase_id,
    updated_at   = NOW()
  WHERE public.users.supabase_id IS NULL;

  RETURN NEW;
END;
$$;

-- 4. Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_supabase_user();

-- 5. Back-fill supabase_id for any existing auth.users that match public.users by email
UPDATE public.users pu
SET supabase_id = au.id,
    updated_at  = NOW()
FROM auth.users au
WHERE pu.email = au.email
  AND pu.supabase_id IS NULL;
