# TORGIMA Forensic Production System Audit

**Audit date:** 2026-06-11  
**Mode:** Read-only forensic audit (no code changes, no fixes)  
**Scope:** Signup, login, onboarding, auth, Supabase, session, API, route guards, database, upgrade/status, background systems, launch mode, frontend boot  
**Architecture:** Cloudflare Pages (torgima.com) + Cloudflare Worker (api.torgima.com) + Supabase + Launch Mode enabled  
**Commits referenced:** `9cdd3f7` (launch mode), `fe0974f` (post-signup auth handoff fix)

---

## Executive Summary

**Verdict:** Account creation works via Supabase email/password, but the post-signup → onboarding handoff was broken by route-guard coupling to `/api/auth/session` and profile ID mapping inconsistencies. Launch Mode (`LAUNCH_MODE=true`) correctly prevents upgrade/status and cron from blocking onboarding, but several scaffolding flags are defined but not wired, and user-facing logout is missing.

**Primary historical blocker:** `useSessionGuard` redirected to `/login` when `/api/auth/session` failed despite a valid Supabase JWT. Fixed in `fe0974f` via `AuthProvider`, resilient session route, and API client 401 handling.

**Top risks remaining after fix:**

| Risk | Severity | Evidence |
|------|----------|----------|
| Dual user-id model (trigger vs runtime) | High | `0040_supabase_auth_migration.sql` vs `lib/auth.ts` |
| `ENABLE_BACKGROUND_BHUDHI` / `ENABLE_TEAM_BOOTSTRAP` unwired | Medium | `launch-mode.ts` — only in tests |
| No user-facing `supabase.auth.signOut()` | Medium | Grep across `torgima/src` |
| Password-reset routes missing in `App.tsx` | Medium | `/auth/update-password` not registered |
| Dual fetch wrappers (`apiFetch` vs `apiRequest`) | Low | `config/api.ts`, `api/client.ts` |

---

## Section 1 — Signup Flow

### 1.1 Frontend signup (`artifacts/torgima/src/pages/signup.tsx`)

- Validates email + password client-side (min 8 chars, one number or capital).
- Calls `supabase.auth.signUp({ email, password, options: { emailRedirectTo: ${origin}/auth/callback } })`.
- **Case A (email confirmation disabled):** `data.session?.access_token` present → `setAuthToken(token)` + redirect `/onboarding`.
- **Case B (email confirmation enabled):** only `data.user` → redirect `/signup/check-email` (added in `fe0974f`).

### 1.2 Backend signup

- **No custom signup route.** Profile creation via:
  - DB trigger `on_auth_user_created` → `handle_new_supabase_user()` in `migrations/0040_supabase_auth_migration.sql`.
  - Runtime fallback `createUserFromSupabase` in `artifacts/api-server/src/lib/auth.ts` on first authenticated request.

### 1.3 Finding

Signup is Supabase-only. No TORGIMA API call at signup time. Correct for lazy initialization.

---

## Section 2 — Login Flow

### 2.1 Frontend login (`artifacts/torgima/src/pages/login.tsx`)

- `supabase.auth.signInWithPassword({ email, password })`.
- On success: `setAuthToken(access_token)`, then `GET /api/auth/session` to read `onboardingComplete`.
- Redirect: `returnTo || (onboardingComplete ? "/dashboard" : "/onboarding")`.
- Error mapping for invalid credentials, email not confirmed, rate limits.

### 2.2 Backend login

- No password login route on Worker — Supabase handles credentials.
- Legacy magic-link routes exist but return `FEATURE_DISABLED` when `ENABLE_MAGIC_LINK_AUTH=false`.

---

## Section 3 — Dual Auth Architecture

TORGIMA runs **two parallel auth systems**:

| System | Status | Token shape | Storage |
|--------|--------|-------------|---------|
| Supabase JWT (primary) | Active | `eyJ…` Bearer | Supabase client + `auth-token.ts` module |
| Legacy magic-link/cookie | Disabled | opaque token | `torgima_session` cookie + KV/DB sessions |

`requireAuth` in `lib/auth.ts`:
- Token starting with `eyJ` → `verifySupabaseJwt` → resolve/create `public.users`.
- Otherwise → legacy `validateSession`.
- `OPTIONAL_SESSION` degrades to anonymous instead of throwing.

---

## Section 4 — Profile ID Mapping (Critical)

### 4.1 Schema (`lib/db/src/schema/tables.ts`)

```
users.id          uuid PK defaultRandom()
users.supabase_id uuid unique
users.email       text unique
```

### 4.2 Two mapping paths (inconsistent)

| Path | `public.users.id` | `supabase_id` |
|------|-------------------|---------------|
| DB trigger (`0040_supabase_auth_migration.sql`) | `defaultRandom()` (random UUID) | `NEW.id` (auth.users.id) |
| Runtime `createUserFromSupabase` (`lib/auth.ts`) | `supabaseId` (= auth.users.id) | `supabaseId` |

Lookup tolerates both: `or(users.id == supabaseId, users.supabase_id == supabaseId, users.email == email)`.

**Finding:** Trigger-created rows have `id != auth.users.id`; runtime-created rows have `id = auth.users.id`. Only `supabase_id` and `email` are reliable join keys.

**Recommended fix (not applied in audit):** Align trigger to `id = NEW.id`.

---

## Section 5 — Session & AuthProvider

### 5.1 AuthProvider (`artifacts/torgima/src/providers/AuthProvider.tsx`) — added `fe0974f`

- On mount: `supabase.auth.getSession()` → seed state + `syncTorgimaProfile`.
- Subscribes to `supabase.auth.onAuthStateChange`.
- Exposes: `loading`, `session`, `user`, `accessToken`, `isAuthenticated`, `refreshProfile`.
- `syncTorgimaProfile`: `GET /api/auth/session`; on failure falls back to local starter session.

### 5.2 useSessionGuard (`artifacts/torgima/src/hooks/useSessionGuard.ts`) — rewritten `fe0974f`

- Waits for `loading=false` before any redirect.
- Redirects to `/login` only when `!isAuthenticated` after loading completes.
- Trusts Supabase session; does not require `/api/auth/session` success to stay authenticated.

### 5.3 GET /api/auth/session (`routes/auth.ts`)

- `requireAuth(req, "OPTIONAL_SESSION")` — never throws on missing token.
- No token → `{ authenticated: false, user: null }`.
- Valid token → load profile via `AuthService.getUser`; on failure return minimal fallback from auth context.
- Never calls upgrade, Bhudhi, signals, cron, or blueprint internally.

---

## Section 6 — API Client & Authorization Header

### 6.1 Token attachment

- `AuthProvider` registers async token getter via `setAuthTokenGetter` → `supabase.auth.getSession()`.
- `apiFetch` (`config/api.ts`) and `apiRequest` (`api/client.ts`) both attach `Authorization: Bearer <token>`.
- `api/client.ts` 401 handling: redirects to login **only when no Supabase token present** (prevents login loops during profile sync).

### 6.2 Finding

Dual fetch wrappers with duplicated auth logic. Only `apiRequest` has 401/redirect handling.

---

## Section 7 — Route Guards & Onboarding Access

### 7.1 Provider tree (`App.tsx`)

`ThemeProvider → QueryClientProvider → AuthProvider → TooltipProvider → WouterRouter → UpgradeGate → AppRoutes`

### 7.2 Four-layer gate stack for `/onboarding`

| Layer | Component | Blocks when | Onboarding safe? |
|-------|-----------|-------------|------------------|
| 1 | `UpgradeGate` | `requiresUpgrade` on non-allowed paths | Yes — onboarding in `isUpgradeAllowedPath` |
| 2 | `ProtectedRoute` / `useSessionGuard` | No session after auth loading | Fixed in `fe0974f` |
| 3 | `useOnboardingActiveBlueprintGuard` | `hasActiveBlueprint` from `/api/onboarding/status` | Redirects to dashboard if blueprint active |
| 4 | `useOnboardingRouteGuard` | Missing goal/purpose/context/validationId in store | Step-sequence gating only |

### 7.3 APIs on authenticated app load

1. `GET /api/auth/session` (AuthProvider)
2. `GET /api/upgrade/status` (UpgradeGate — cached, non-blocking in launch mode)

### 7.4 Onboarding happy path

1. `/signup` → Supabase signUp → `/onboarding` (or `/signup/check-email`)
2. Goal → context → structure → review
3. Review: `POST /api/onboarding/goal` (draft blueprint) → validation run → `/onboarding/validating`
4. Results → select blueprint → `POST /api/onboarding/select-blueprint` → `/dashboard`

---

## Section 8 — /api/upgrade/status

### 8.1 Backend (`routes/upgrade.ts`)

- `GET /upgrade/status` with `requireAuth(req, "OPTIONAL_SESSION")`.
- No userId → `UPGRADE_GUEST_RESPONSE` (always `upgradeRequired: false`).
- `isLaunchMode()` or `!isAdvancedUpgradeGateEnabled()` → fast path, zero DB queries.
- Catch block → guest defaults. **Never returns 500.**

### 8.2 Frontend callers

- **Only** `UpgradeGate.tsx` calls `/api/upgrade/status`.
- Onboarding paths exempt from upgrade redirect.
- Module-level cache: `launchMode:true` responses cached indefinitely.

---

## Section 9 — Launch Mode Flags

Defined in `wrangler.toml`, read in `lib/launch-mode.ts`:

| Flag | Value | Effect | Wired in production? |
|------|-------|--------|----------------------|
| `LAUNCH_MODE` | `"true"` | Skips ALL crons; upgrade fast path | Yes — `cloudflare-cron.ts`, `upgrade.ts` |
| `EVENT_DISPATCH_CRON_ENABLED` | `"false"` | Event-dispatch poll | Yes — `EventDispatcher.ts` |
| `ENABLE_ADVANCED_UPGRADE_GATE` | `"false"` | Archive/migration upgrade queries | Yes — `upgrade.ts` |
| `ENABLE_SIGNAL_AUTO_BOOTSTRAP` | `"false"` | Signal engine on launch | Yes — `BlueprintLaunchService.ts` |
| `ENABLE_BACKGROUND_BHUDHI` | `"false"` | Background Bhudhi | **No — tests only** |
| `ENABLE_TEAM_BOOTSTRAP` | `"false"` | Team creation on signup | **No — tests only** |
| `ENABLE_MAGIC_LINK_AUTH` | `"false"` | Legacy magic-link | Yes — `auth.ts` |

With `LAUNCH_MODE=true`, all 5 cron triggers return immediately — no background work runs.

---

## Section 10 — Cron & Background Systems

### 10.1 Cron triggers (`wrangler.toml`)

`0 2 * * *`, `*/30 * * * *`, `0 3 * * *`, `*/10 * * * *`, `* * * * *`

Mapped: session-cleanup, inactivity-scan, pattern-daily, state-integrity, event-dispatch-poll.

### 10.2 Auto-start behavior

| System | Auto-start | Gated by |
|--------|------------|----------|
| Signals | Lazy (page load) | `ENABLE_SIGNAL_AUTO_BOOTSTRAP` on launch only |
| Bhudhi | On page open only | `ENABLE_BACKGROUND_BHUDHI` (unwired) |
| Teams | Never on signup | `ENABLE_TEAM_BOOTSTRAP` (unwired) |
| Event dispatch | Cron (disabled) | `LAUNCH_MODE` + `EVENT_DISPATCH_CRON_ENABLED` |

---

## Section 11 — Database Tables per Flow

| Flow | Tables touched |
|------|------------------|
| Signup/login | `users` (read/insert), legacy `sessions`, `magic_link_tokens` |
| Onboarding | `users.onboarding_complete`, `blueprints` (draft insert) |
| Validation | `validations`, `blueprints`, `economic_archetypes`, panel tables |
| Blueprint launch | `blueprints` (update), `validations`, sequence/task tables |
| Dashboard | `blueprints`, `orders`, `signal_snapshots`, `conditions`, `pivot_reviews`, `system_health_logs`, `feature_flags`, `validations`, `phases`, `feedback`, etc. |

---

## Section 12 — Dashboard Data Loading

- **Frontend:** `pages/dashboard.tsx` → `useDashboardProjection()` → `GET /api/state/dashboard` (polls 3–5s).
- **API:** `routes/state.ts` → `DashboardService.getDashboardState`.
- No active blueprint → `buildNoActiveBlueprintDashboardState`; otherwise parallel queries for signals, conditions, enforcement, home panels.

---

## Section 13 — Anomalies & Gaps

1. **No user-facing logout** — `logout()` in `api/auth.ts` unused; no `supabase.auth.signOut()` in main app.
2. **Broken password-reset chain** — `forgot-password.tsx` → `/auth/reset-password`; callback → `/auth/update-password`; neither route in `App.tsx`.
3. **Silent auth disable** — missing `VITE_SUPABASE_*` envs → placeholder client, auth fails quietly.
4. **Unwired feature gates** — `ENABLE_BACKGROUND_BHUDHI`, `ENABLE_TEAM_BOOTSTRAP` change nothing in production.
5. **Full background freeze** — all crons dormant under `LAUNCH_MODE=true`.

---

## Section 14 — Root Cause Analysis (Post-Signup Redirect)

### Chain before `fe0974f`

1. User signs up → Supabase returns session + JWT.
2. Frontend redirects to `/onboarding` (protected route).
3. `useSessionGuard` calls `/api/auth/session` before Supabase auth state is stable.
4. Session route fails (profile sync/id mapping) or returns slowly.
5. Guard treats user as unauthenticated → redirect `/login`.
6. `api/client.ts` 401 handler may amplify redirect loop.

### Fix applied (`fe0974f`)

| Change | File |
|--------|------|
| Central Supabase auth state | `providers/AuthProvider.tsx` (new) |
| Trust Supabase session in guard | `hooks/useSessionGuard.ts` |
| Idempotent profile sync, `id = supabaseId` | `lib/auth.ts` |
| Resilient session route + fallback profile | `routes/auth.ts` |
| Check-email page for confirmation case | `pages/signup/check-email.tsx` |
| No 401 redirect when token exists | `api/client.ts` |
| Debug probe endpoint | `routes/debug.ts` → `GET /api/debug/auth-flow` |

---

## Final Deliverables

### 1. Signup mechanism
Supabase `signUp` only. No backend signup route.

### 2. Auth model
Supabase JWT primary; legacy magic-link disabled (`ENABLE_MAGIC_LINK_AUTH=false`).

### 3. Profile mapping
Inconsistent: trigger uses random `id`, runtime uses `id = supabaseId`. Lookup via `supabase_id` + email.

### 4. Session persistence
Supabase client with `persistSession`, `autoRefreshToken`, `storageKey: torgima-auth-token`.

### 5. Route guard behavior
Four layers; primary blocker was layer 2 coupling to API session — fixed in `fe0974f`.

### 6. Upgrade/status blocking
Non-blocking in launch mode. Only caller is `UpgradeGate`. Onboarding paths exempt.

### 7. Onboarding dependencies
Does not require upgrade success, active blueprint, or onboarding_complete on entry. Requires auth only.

### 8. Launch mode status
Enabled. All crons skipped. Upgrade fast path active. Signal bootstrap gated.

### 9. Background systems
Frozen. Bhudhi/team flags defined but unwired.

### 10. Cron status
All 5 triggers no-op under `LAUNCH_MODE=true`.

### 11. Dashboard requirements
Requires active blueprint for full state; handles `NO_BLUEPRINT` gracefully.

### 12. Missing user flows
Logout, password-reset page registration.

### 13. Debug endpoints
`GET /api/debug/auth-flow` (internal auth) — present after `fe0974f`.

### 14. Test coverage
1607+ unit tests passed at time of `fe0974f`; `post-signup-auth-handoff.test.ts` added.

### 15. Production verification checklist
- Confirm `fe0974f` deployed to production
- Verify Supabase migration 0040 applied
- Verify Worker secrets (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, etc.)
- Probe `GET /api/debug/auth-flow` with internal auth
- Manual flow: signup → onboarding without login redirect

### 16. Recommended follow-up fixes (audit-only, not implemented)
- Align `handle_new_supabase_user` trigger to `id = NEW.id`
- Wire or remove `ENABLE_BACKGROUND_BHUDHI` / `ENABLE_TEAM_BOOTSTRAP`
- Add user-facing logout (`supabase.auth.signOut()`)
- Register `/auth/update-password` in `App.tsx`
- Consolidate `apiFetch` and `apiRequest`

---

## Production Architecture Reference

| Component | URL / Name |
|-----------|------------|
| Frontend | https://torgima.com (Cloudflare Pages: torgima-execution) |
| API | https://api.torgima.com (Cloudflare Worker: torgima) |
| Database/Auth | Supabase |
| Email | Resend |
| AI | Anthropic |
| KV | SESSIONS → TORGIMA_SESSIONS |

---

*Read-only forensic audit compiled from source inspection and subagent evidence. No production changes made during audit. Post-signup fix documented from commit `fe0974f`.*
