# TORGIMA Production Verification Answers

**Report date:** 2026-06-11  
**Scope:** Live probes against production (`api.torgima.com`, `torgima.com`, Supabase `fmynbziciuadnvjlojub`)  
**Context:** Post-signup onboarding failure investigation (commit `fe0974f` referenced)

---

## Executive Summary

Signup works in Supabase and returns a session, but **profile sync to `public.users` fails** because migration `0040_supabase_auth_migration.sql` is **not applied** — the `supabase_id` column and `on_auth_user_created` trigger are missing. The Worker returns HTTP 500 on `GET /api/auth/session` with `"Profile sync failed — please try again"`. `public.users` had **0 rows** while `auth.users` had **6 rows**.

**Root cause chain:** Signup → Supabase session → Worker `requireAuth` queries/inserts `supabase_id` → column missing → profile sync 500 → onboarding APIs blocked.

---

## Question 1 — Is production currently running commit fe0974f?

**Answer: Cannot confirm the exact hash.**

Cloudflare does not expose a git SHA on health/API responses. Cloudflare Builds MCP returned Unauthorized.

**Strong evidence it is fe0974f or later:**

| Marker | Production |
|--------|------------|
| Worker error text "Profile sync failed — please try again" | Present (live GET /api/auth/session) |
| GET /api/debug/auth-flow | Exists (403, not 404) |
| launchMode: true on /api/upgrade/status | Present |
| Frontend bundle has AuthProvider, check-email, refreshProfile | Present on torgima.com |

`origin/main` is at `fe0974f` locally. CI deploys on push to `main`, so deployment is very likely but not hash-verified.

---

## Question 2 — What git commit hash is deployed on Cloudflare right now?

**Answer: Unknown.**

No commit metadata in API responses or Pages headers. Cloudflare dashboard or GitHub Actions run logs would be required.

---

## Question 3 — Is Supabase email confirmation enabled or disabled?

**Answer: Disabled (auto-confirm on signup).**

Supabase auth logs show `"immediate_login_after_signup": true` on every recent signup. `email_confirmed_at` is set within ~30ms of `created_at`.

---

## Question 4 — After signup, does Supabase return a session?

**Answer: Yes.**

Live test (POST /auth/v1/signup) returned both `user` and `access_token`. Supabase logs show immediate login after signup for accounts including `torgimachronicles@gmail.com` (2026-06-11 08:05 UTC).

---

## Question 5 — Does auth.users contain the new account?

**Answer: Yes.**

Production has 6 rows in `auth.users`, including recent signups (`torgimachronicles@gmail.com`, `saboorrhh99@gmail.com`, etc.). Live probe signup also created a row successfully.

---

## Question 6 — Does public.users contain the same account?

**Answer: No (for normal signups).**

At audit time, `public.users` count was 0 while `auth.users` count was 6. None of the 6 auth users had a matching `public.users` row by email. This is the core profile-sync break.

---

## Question 7 — What does GET /api/auth/session return immediately after signup?

**With a valid Supabase JWT from a fresh signup:**

```
HTTP 500
{
  "ok": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Profile sync failed - please try again",
    "class": "engine_error",
    "retryable": true
  }
}
```

**Without a token:**

```
HTTP 200
{ "authenticated": false, "user": null }
```

`/api/upgrade/status` with the same token returns HTTP 200 with `authenticated: false` (errors are swallowed to guest defaults).

---

## Question 8 — What exact route redirects back to /login?

In the fe0974f frontend on torgima.com, redirect paths are:

1. **Primary:** `ProtectedRoute` in `App.tsx` → `<Redirect to="/login" />` when `useSessionGuard` reports `!authenticated` after auth loading finishes.
2. **Secondary:** `useSessionGuard` → `setLocation("/login")` when `loading === false` and no Supabase session.
3. **Tertiary:** `api/client.ts` → `redirectToLogin()` → `/login?returnTo=...` on 401 only when no Supabase token is present.

With fe0974f, `isAuthenticated` is tied to the Supabase JWT, not `/api/auth/session` success — so a session API 500 alone should not trigger redirect if the Supabase session is present.

If users still hit `/login`, likely causes: no Supabase session persisted before navigation, cached pre-fe0974f bundle, or traffic on Vercel preview (`torgima-execution-tornicles-projects.vercel.app` appears in Supabase signup referers).

---

## Question 9 — Does onboarding fail before rendering or after rendering?

**Depends on frontend version and session persistence:**

| Scenario | Behavior |
|----------|----------|
| fe0974f + Supabase session present | Should pass guard (fallback profile), render onboarding; backend APIs still 500 |
| No Supabase session after signup | Before render — redirect to /login via ProtectedRoute |
| Pre-fe0974f bundle | Before render — session API failure treated as unauthenticated |

Given live backend failures, onboarding cannot complete functionally even if the form renders, because protected APIs fail at `requireAuth` profile sync.

---

## Question 10 — Is migration 0040 applied in production?

**Answer: No.**

| Check | Result |
|-------|--------|
| public.users.supabase_id column | Missing |
| on_auth_user_created trigger on auth.users | None |
| Supabase list_migrations | Only bhudhi_schema_upgrade, phase7_schema_verification — not 0040 |
| GET /api/health/schema | HTTP 500 |

---

## Question 11 — Does /api/debug/auth-flow report profileFound=true?

**Answer: Cannot call from external probe.**

The route requires INTERNAL_SERVICE auth (`INTERNAL_AUTH_SECRET`). Unauthenticated requests get 403 Forbidden.

Given live behavior, if called with a valid user JWT and internal auth, `publicProfileFound` would be false and `publicProfileCreated` would fail because Drizzle queries reference the missing `supabase_id` column.

---

## Question 12 — What exact Cloudflare log appears during onboarding failure?

Cloudflare Observability MCP returned Unauthorized; Worker logs were not readable from the audit environment.

From code and live API behavior, the expected Worker log on auth failure is:

```
[Auth] Could not create public.users row for Supabase user
err: column "supabase_id" does not exist (or similar Drizzle/Postgres error)
```

Followed by HTTP 500 on `GET /api/auth/session` with message `Profile sync failed — please try again`.

Postgres logs also show unrelated cron noise (invalid input syntax for type uuid: "health", FK violations on events / system_health_logs).

---

## Recommended Fix

Run `migrations/0040_supabase_auth_migration.sql` in the Supabase SQL Editor. This adds:

- `public.users.supabase_id` column
- `handle_new_supabase_user()` trigger on `auth.users`
- Automatic sync of new signups into `public.users`

After applying, re-test: signup → GET /api/auth/session (expect authenticated:true) → /onboarding loads.

---

## Production Architecture Reference

| Component | URL / Name |
|-----------|------------|
| Frontend | https://torgima.com (Cloudflare Pages: torgima-execution) |
| API | https://api.torgima.com (Cloudflare Worker: torgima) |
| Database/Auth | Supabase project fmynbziciuadnvjlojub |
| Latest repo commit (main) | fe0974f — fix: stabilize post-signup onboarding auth handoff |

---

*Generated from live production HTTP tests, Supabase SQL/logs, and frontend bundle inspection. Audit performed 2026-06-11.*
