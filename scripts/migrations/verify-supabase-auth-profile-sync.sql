-- Post-migration verification for Supabase auth profile sync
-- Run in Supabase SQL Editor after manual-20260611-supabase-auth-profile-sync.sql

-- 1. Confirm supabase_id column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'supabase_id';

-- 2. Confirm trigger exists on auth.users
SELECT tgname AS trigger_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal;

-- 3. Row counts
SELECT
  (SELECT count(*) FROM auth.users) AS auth_users_count,
  (SELECT count(*) FROM public.users) AS public_users_count,
  (SELECT count(*) FROM public.users WHERE supabase_id IS NOT NULL) AS public_with_supabase_id;

-- 4. auth.users emails missing public.users profiles
SELECT au.id AS auth_id, au.email AS auth_email, au.created_at
FROM auth.users au
LEFT JOIN public.users pu
  ON pu.supabase_id = au.id
  OR lower(trim(pu.email)) = lower(trim(au.email))
WHERE pu.id IS NULL
ORDER BY au.created_at DESC;

-- 5. Test specific user (replace email as needed)
SELECT
  au.id AS auth_id,
  au.email AS auth_email,
  pu.id AS public_id,
  pu.email AS public_email,
  pu.supabase_id,
  pu.mode,
  pu.tier,
  pu.onboarding_complete
FROM auth.users au
LEFT JOIN public.users pu
  ON pu.supabase_id = au.id
  OR lower(trim(pu.email)) = lower(trim(au.email))
WHERE lower(trim(au.email)) = lower(trim('tmagaya@tornicles.com'));
