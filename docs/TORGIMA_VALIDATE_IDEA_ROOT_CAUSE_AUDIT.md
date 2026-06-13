# TORGIMA Validate Idea — Production Root Cause Audit

**Report date:** 2026-06-11  
**Scope:** `POST /api/bhudhi/structure-goal` ("Validate Idea" onboarding step)  
**Environment:** `api.torgima.com`, Supabase `fmynbziciuadnvjlojub`, Cloudflare Workers

---

## Executive Summary

Authentication, signup, login, and Supabase session creation work in the browser. Goal, Context, and Review onboarding pages work because they are primarily client-side draft flows. **Failure begins when the user presses "Validate Idea"**, which calls `POST /api/bhudhi/structure-goal`.

**Root cause:** The Cloudflare Worker cannot reach PostgreSQL. `GET /api/health` reports `database timed out after 8s`. Every authenticated API route fails at `requireAuth()` when resolving `public.users`, returning HTTP 500 with `"Profile sync failed — please try again"`. **Bhudhi and Anthropic are never invoked.**

Migration 0040 (profile sync backfill) is applied — profiles exist in Supabase. The Worker still cannot read them due to `DATABASE_URL` connectivity.

---

## Route Correction

| User reference | Actual production route |
|----------------|-------------------------|
| `/api/hi/structure-goal` | **`POST /api/bhudhi/structure-goal`** |

Frontend: `artifacts/torgima/src/api/onboarding.ts` → `structureGoal()`  
Backend: `artifacts/api-server/src/routes/bhudhi.ts:45`

---

## Execution Trace

| Step | File | Function / action |
|------|------|-------------------|
| 1 | `artifacts/api-server/src/app.ts` | `/api` middleware (rate limits) |
| 2 | `artifacts/api-server/src/routes/bhudhi.ts:45` | POST handler (anonymous async) |
| 3 | `artifacts/api-server/src/lib/auth.ts:123` | `requireAuth(req, "USER_SESSION")` |
| 4 | `artifacts/api-server/src/lib/supabase.ts:45` | `verifySupabaseJwt()` → Supabase Auth `getUser(token)` |
| 5 | `artifacts/api-server/src/lib/auth.ts:41` | `resolveUserFromSupabase()` → SELECT `public.users` |
| 6 | `artifacts/api-server/src/services/ValidationService.ts:222` | `structureGoal()` *(not reached when DB down)* |
| 7 | `artifacts/api-server/src/engines/validation/ValidationEngine.ts:443` | `structureGoalWithBhudhi()` → `routeBhudhiRequest()` |
| 8 | `artifacts/api-server/src/bhudhi/BhudhiCore.ts:107` | `invokeAnthropicModel()` *(not reached)* |

**First line executed:** `bhudhi.ts:47` — `const auth = await requireAuth(req, "USER_SESSION")`  
**First external service (succeeds):** Supabase Auth API — `supabase.auth.getUser(token)`  
**First database query (fails):** `SELECT id, mode, tier FROM public.users WHERE supabase_id = $1 LIMIT 1`

---

## Live Production Evidence (2026-06-11 09:50 UTC)

### POST /api/bhudhi/structure-goal

```
HTTP 500
requestId: 04cec1eb-7cc6-4fea-9876-dd7d95a7fd72
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

### GET /api/auth/session (same JWT)

```
HTTP 500
requestId: adc5d067-2d98-4975-8e59-13461ccadd5c
message: "Profile sync failed - please try again"
```

### GET /api/health

```
status: critical
checks.database: { ok: false, detail: "database timed out after 8s" }
checks.anthropic: { ok: true, detail: "ANTHROPIC_API_KEY present" }
checks.database_url: { ok: true, detail: "postgres URL present" }
checks.signals: { ok: false, detail: "Failed query: SELECT COUNT(*)..." }
```

### Supabase DB state (via SQL Editor)

- User `audit-structure-20260611044954@tornicles.com` exists in **both** `auth.users` and `public.users`
- `supabase_id` matches auth user id
- Migration 0040 backfill: 7 auth users / 7 public users / 0 missing profiles

**Conclusion:** Profile data exists; Worker cannot query Postgres.

---

## Anthropic Investigation

| # | Question | Answer |
|---|----------|--------|
| 1 | Is Anthropic SDK installed? | **Yes** — `@anthropic-ai/sdk` in `artifacts/api-server/package.json` |
| 2 | Is Anthropic imported? | **Yes** — `artifacts/api-server/src/bhudhi/BhudhiCore.ts` |
| 3 | Is client instantiated? | **Yes** — `getAnthropicClient()` in BhudhiCore |
| 4 | Which model? | `claude-sonnet-4-20250514` (env `BHUDHI_MODEL` override) |
| 5 | ANTHROPIC_API_KEY in Cloudflare production? | **Yes** — `/api/health` reports present |
| 6 | API key in local dev? | Depends on local `.env` (not probed) |
| 7 | Does API request leave the server? | **No** — request dies in `requireAuth` before Bhudhi |
| 8 | Does Anthropic respond? | **N/A** — not reached |
| 9 | Exact response? | **N/A** |
| 10 | Anthropic exceptions thrown? | **None** — pipeline never starts |

---

## Bhudhi Investigation

| # | Question | Answer |
|---|----------|--------|
| 1 | Route implemented? | **Yes** — `bhudhi.ts` POST `/bhudhi/structure-goal` |
| 2 | Calling Anthropic? | **Would** via `routeBhudhiRequest` → `invokeBhudhiModel` when `ai_enabled` |
| 3 | Calling OpenAI? | **No** — `bhudhiProviders.ts`: Claude only |
| 4 | Mock responses? | Deterministic fallback in `structureGoalDeterministic()` — not reached |
| 5 | Feature flag disabled? | `getAiEnabled()` reads `feature_flags.ai_enabled` (defaults false if missing) |
| 6 | Structured output? | **Yes** when pipeline runs — `StructuredGoalDraft` |
| 7 | Writing to database? | **Would** write `bhudhi_logs` — not reached |

---

## Database Investigation (this failure path)

| Table | Query | Result | Error |
|-------|-------|--------|-------|
| `public.users` | SELECT by `supabase_id` | **Timeout / no rows returned to app** | Connection timeout (~8s) |
| `public.users` | INSERT on profile sync safety net | **Fails** | Same connection failure |
| `feature_flags` | SELECT `ai_enabled` | **Not reached** | — |
| `bhudhi_logs` | INSERT usage log | **Not reached** | — |

When DB is healthy, Validate Idea also touches: `feature_flags`, `bhudhi_logs`, `bhudhi_usage_budget`, and optional world-model tables via `getWorldModel()`.

---

## Cloudflare Investigation

| Field | Value |
|-------|-------|
| Request ID (structure-goal) | `04cec1eb-7cc6-4fea-9876-dd7d95a7fd72` |
| Request ID (session) | `adc5d067-2d98-4975-8e59-13461ccadd5c` |
| Worker log / stack trace | Cloudflare Observability MCP returned Unauthorized — use dashboard with request IDs above |
| Exception | `TorgimaError: INTERNAL_ERROR — Profile sync failed` |
| Failing file | `artifacts/api-server/src/lib/auth.ts` |
| Failing line | **179–182** (throw after `createUserFromSupabase` catch) |

---

## Root Cause (7-item summary)

### 1. First failing function

`requireAuth()` → profile sync branch (`resolveUserFromSupabase` returns null; `createUserFromSupabase` throws)

### 2. First failing line

`artifacts/api-server/src/lib/auth.ts` lines **179–182** — `throw new TorgimaError("INTERNAL_ERROR", "Profile sync failed — please try again", ...)`

### 3. First failing query

```sql
SELECT id, mode, tier FROM public.users WHERE supabase_id = $1 LIMIT 1
```

Worker Postgres connection times out (`GET /api/health`: `database timed out after 8s`).

### 4. First failing API call

**PostgreSQL** via Worker `DATABASE_URL` — not Anthropic. Supabase Auth `getUser()` succeeds.

### 5. Root cause

Cloudflare Worker **`DATABASE_URL` is misconfigured or unreachable** (commonly direct `db.<ref>.supabase.co:5432` instead of **Transaction Pooler** `*.pooler.supabase.com:6543`). JWT auth works via Supabase Auth API; all DB-dependent routes fail with profile sync 500. Validate Idea never reaches Bhudhi or Anthropic.

### 6. Minimal fix

Update Worker secret `DATABASE_URL` to Supabase **Transaction pooler** URL:

- Host: `aws-0-<region>.pooler.supabase.com`
- Port: `6543`
- User: `postgres.fmynbziciuadnvjlojub`
- `sslmode=require`

```bash
wrangler secret put DATABASE_URL
```

Confirm: `GET /api/debug/db-target` (internal auth) → `probe.ok: true`, `elapsedMs < 1000`.

### 7. Verification proof

| Check | Expected after fix |
|-------|-------------------|
| `GET /api/health` | `checks.database.ok: true` |
| `GET /api/auth/session` + JWT | `authenticated: true` |
| `POST /api/bhudhi/structure-goal` + JWT | HTTP **200**, `{ ok: true, data: { structured, canProceed } }` |
| Validate Idea UI | Exits structuring spinner; proceeds to clarify or review |

---

## Why earlier pages appear to work

| Page | Behavior |
|------|----------|
| Goal / Context / Review | Client-side `PreValidationDraft` — no Bhudhi API required |
| Supabase session | Browser-held JWT via Supabase client — independent of Worker DB |
| Validate Idea | First step requiring Worker DB + `requireAuth` profile lookup |

---

*Generated from production probes and codebase trace. TORGIMA Execution OS.*
