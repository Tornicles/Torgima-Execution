# AUDIT CLOSURE — 2026-05-27

## System Status: BLOCKED — Supabase credentials required in this environment

Production code is on `main` (`56324d7`). Local gate passed (typecheck, lint, test, build, `verify:lifecycle` on `torgima_test`).

**This environment has no `DIRECT_URL` / production `DATABASE_URL`** (only `.env.local` → localhost). Steps 1–2 must be run on your machine with Supabase URLs.

### One-command production gate (after setting env)

```powershell
$env:DIRECT_URL = "postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
$env:DATABASE_URL = "postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
node scripts/apply-production-gate.mjs
pnpm verify:lifecycle
```

### Railway smoke (2026-06-01, no deploy action taken)

| Endpoint | Result |
|----------|--------|
| `GET https://workspaceapi-server-production-63b3.up.railway.app/health` | `{"ok":true}` |
| `GET .../api/health` | `degraded` — `database: ok`, `workers: ok`, `bhudhi: ok`, `signals: error` |

Deploy is assumed current from last `git push origin main`; Railway CLI not installed here.

## What Was Fixed (3 passes)
### Pass 1 — Phase 3 Repairs
- Legacy feedback route removed (POST /api/feedback/task)
- Weekly review / phase checkpoint shortcuts fixed → FEEDBACK_SUBMITTED
- StructuredFeedbackService: feedback_id required, TorgimaError on failure
- Bhudhi critical triggers throw BHUDHI_LOG_FAILURE on log insert failure
- MEMORY_DEPTH_BY_TIER enforced; session memory cleared on logout
- Logger replaces console in ErectorOrchestrationService, boot.ts, queue.ts
- EnforcementPackageGenerator marked STUB
- Route refactors: feedback.ts, orders.ts, blueprints.ts, signals.ts, conditions.ts
  → zero inline DB queries in routes

### Pass 2 — Lifecycle Implementation  
- CONDITION_TASK_LIMITS: stability 5-7, power/affluence 6-8, urgency 3-5
- selectTaskCount: streak_bonus every 3 days
- Daily midpoint top-up in ExecutionContinuityScheduler / DailyCycleWorker
- Tier rules: +1/+2 instead of clamping down
- maxDailyOrders: starter 7, growth/ultimate 8
- task_generation_log.idempotency_key column added

### Pass 3 — Closure
- Git committed (3 commits: repairs, lifecycle, audit closure)
- Full lint scope enabled (`artifacts/api-server/src`, `lib`) and passing
- All unit tests passing
- verify:lifecycle: PASS (local `torgima_test` 2026-06-01)

## Pending Before Production Deploy (owner: operator with Supabase access)
- [ ] `node scripts/apply-production-gate.mjs` (or apply 5 SQL files below manually)
- [ ] `pnpm verify:lifecycle` on production `DATABASE_URL`
- [ ] Mark migrations ✓ in table below
- [ ] Optional: invalidate stale `enforcement_packages` (SQL in PENDING PRODUCTION MIGRATIONS section)
- [ ] Confirm Railway `/health` after deploy (already `ok:true` on 2026-06-01)

## Verification (local gate — 2026-06-01)
- ✓ pnpm typecheck — PASS
- ✓ pnpm lint (full scope) — PASS
- ✓ pnpm test:unit — PASS (1231 tests)
- ✓ pnpm build — PASS
- ✓ pnpm verify:lifecycle — PASS (local Postgres)
- ✓ Migrations 1–4 + idempotency column — applied and verified locally (`scripts/verify-migration-gate.mjs`)

## Known Acceptable State
- EnforcementPackageGenerator.ts: STUB — live path uses ControlEngine.generateEnforcementPackage
- Full api-server route refactor: orders.ts, blueprints.ts, signals.ts, conditions.ts completed
- Bhudhi memory: session-scope memory (starter tier) clears on logout
- Team mode: disabled via feature flag (team_mode_enabled=false)

---

# PENDING PRODUCTION MIGRATIONS — RUN BEFORE DEPLOY

Apply on Supabase with direct connection (replace `[supabase direct url]`):

```bash
DIRECT_URL="[supabase direct url]" psql "$DIRECT_URL" -f scripts/migrations/manual-20260528-structured-feedback.sql
DIRECT_URL="[supabase direct url]" psql "$DIRECT_URL" -f scripts/migrations/manual-20260601-missing-tables-repair.sql
DIRECT_URL="[supabase direct url]" psql "$DIRECT_URL" -f scripts/migrations/manual-20260601-bhudhi-log-repair.sql
DIRECT_URL="[supabase direct url]" psql "$DIRECT_URL" -f scripts/apply-partial-indexes.sql
DIRECT_URL="[supabase direct url]" psql "$DIRECT_URL" -f lib/db/migrations/20260527120000_add_task_generation_log_idempotency_key.sql
```

After each migration is applied on production, mark with `✓ applied [date]` in this section.

| Migration | Status |
|-----------|--------|
| manual-20260528-structured-feedback.sql | NOT APPLIED |
| manual-20260601-missing-tables-repair.sql | NOT APPLIED |
| manual-20260601-bhudhi-log-repair.sql | NOT APPLIED |
| scripts/apply-partial-indexes.sql | NOT VERIFIED |
| lib/db/migrations/20260527120000_add_task_generation_log_idempotency_key.sql | NOT APPLIED |

### verify:lifecycle integration test

✓ **PASSED** — 2026-06-01 — environment: local Postgres (`pnpm postgres:up` → `.env.local`)

Re-run on Supabase before production:

```bash
pnpm verify:lifecycle
```

Expected assertions:
- >= 3 tasks after blueprint activation
- new tasks after feedback submission
- task count within stability range (5-7) after condition=stability
- daily top-up generates tasks when pending < midpoint
- blueprint position advances after task completion

Test user: `gap-g9-acceptance@torgima-test.local` (deleted on script exit).

---

# Torgima Full Audit Log (TORGIMA_FULL_AUDIT_FIX_COMMIT_PROMPT)

Stack audited: **pnpm monorepo** — Express `@workspace/api-server`, Drizzle `@workspace/db`, Vite `@workspace/torgima` (not Next.js/Prisma paths from the docx template).

## Duplicates removed

- No duplicate engine files removed (single `TaskGenerationEngine.ts`; `BhudhiCore` retained as internal delegate behind `routeBhudhiRequest`).
- `EventSystem.emitEvent` kept as Prompt 8 facade over `EventService.writeEvent` (documented dual layer, not merged to avoid breaking idempotency records).

## Misalignments fixed

- Added Drizzle migration `0006_erector_execution_bridge.sql` (`blueprint_tier`, archetype mult columns, `smoke_test` task type).
- Extended `verifySchema.ts` runtime preflight to require Erector blueprint/validation columns (catches missing `blueprint_tier` before integration tests fail).
- Composite index `idx_feedback_blueprint_created_at` on `feedback(blueprint_id, created_at)` (orders already had `idx_orders_blueprint_status`).

## Magic link steps fixed

- Email subject/body aligned to audit spec (“Your Torgima access link”, 15-minute expiry, do-not-share copy, CTA button).
- Flow already correct: `AuthService` → SHA-256 hashed token in `sessions` with `magic:` prefix → `/verify` SPA → `POST /api/auth/verify` → cookie session.

## Bottlenecks eliminated

- Feedback window queries: new `(blueprint_id, created_at)` index.
- Schema preflight now validates column presence (reduces opaque 42703 failures at runtime).

## Execution loop status

- **FULLY WIRED**: `FeedbackWorker` → `SignalWorker` → `ConditionWorker` → `ControlWorker` → `TaskGenerationWorker`; workers started from `artifacts/api-server/src/index.ts` via `startWorkers()`.

## Missing files created

- `migrations/0006_erector_execution_bridge.sql`
- `docs/full-audit-fix-commit-prompt.txt`, `docs/AUDIT_LOG.md`
- Prompt 9 Erector test suite files (fixtures, acceptance 21–41, E2E E1–E6)

## Tests

- `pnpm run typecheck` — required before commit
- `pnpm run test:unit` — api-server unit suites
- Integration/E2E: require `TORGIMA_INTEGRATION=true`, `DATABASE_URL`, and `pnpm db:migrate` + `pnpm db:apply-manual`

## Recurring CI / deploy breakage (root cause)

Three separate paths were applying schema differently:

| Environment | Schema apply |
|-------------|----------------|
| Railway (`railway.json`) | `pnpm db:migrate` → `pnpm db:apply-manual` |
| GitHub Phase 9 E2E (was) | `push-force` only, or `migrate` on empty DB (fails) |
| API boot preflight (was) | Full Erector column check → `process.exit(1)` |

**Symptoms:** Magic link “network error” (API never listened), Phase 9 E2E 42703 / missing columns, unit test `phase6-prompt` failures on standalone word `task` in UI copy.

**Fixes (2026-05-22):**

- CI Phase 9 job uses `pnpm db:ci` (`push-force` + `apply-manual`) for **empty** Postgres; Railway keeps `migrate` + `apply-manual` on **existing** DBs.
- Boot preflight: `BOOT_CRITICAL_COLUMNS` only blocks start; Erector columns warn (`fe875e1`).
- `FirstWeekPlanPanel.tsx`: execution-language compliant copy (`Order` not `task`).
- `vitest.setup.ts`: unit runs always use `torgima_vitest_stub` URL so local `.env` cannot hijack CI-style unit jobs.

## Manual action

- Production/Railway: run `pnpm db:migrate` and `pnpm db:apply-manual` (use `DIRECT_URL` for DDL).
- Apply `scripts/apply-partial-indexes.sql` if partial unique indexes are not yet on the database.
- Set `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL` (or `APP_URL`) for outbound magic links in production.

---

## Phase 3 repairs (2026-06-01)

### P1 — Execution loop (COMPLETE)

| Fix | Status | Notes |
|-----|--------|-------|
| 1A Legacy `POST /api/feedback/task` | DONE | **Removed** — no callers in `artifacts/torgima/src` (uses `/api/feedback/submit` + `/api/orders/:id/feedback`) |
| 1B Weekly review / phase checkpoint shortcuts | DONE | Emit `FEEDBACK_SUBMITTED` + `dispatchPendingEvents()` instead of direct `TASK_GENERATION_REQUESTED` |
| 1C Structured feedback `feedback_id` | DONE | `StructuredFeedbackService` persists feedback rows with `.returning()`, requires `feedback_id` in outbox payload |

### P2 — Database integrity (PENDING PRODUCTION)

| Fix | Status | Notes |
|-----|--------|-------|
| 2A Manual migrations | **NOT APPLIED** | See PENDING PRODUCTION MIGRATIONS section above |
| 2B Partial indexes | **NOT VERIFIED** | `scripts/apply-partial-indexes.sql` ready |

### P3 — Route refactoring (COMPLETE for Phase 3 targets)

| Route | Status |
|-------|--------|
| `routes/feedback.ts` | **DONE** — `FeedbackAuxiliaryService.ts` |
| `routes/orders.ts` | **DONE** — `OrderService` |
| `routes/blueprints.ts` | **DONE** — `BlueprintRouteService` |
| `routes/signals.ts` | **DONE** — `SignalService.getApi*` |
| `routes/condition.ts` | **DONE** — `ConditionService` |

### P4 — Bhudhi layer (COMPLETE)

- **4A** `BhudhiCore`: critical triggers throw `TorgimaError` (`BHUDHI_LOG_FAILURE`) on log insert failure.
- **4B** `BhudhiMemoryService`: `MEMORY_DEPTH_BY_TIER`; `clearSessionScopeForUser` on logout.

### P5 — Worker / logging hygiene (COMPLETE)

- **5A** `ErectorOrchestrationService`, `boot.ts`, `queue.ts` → pino logger.
- **5B** `EnforcementPackageGenerator` documented as STUB.

### P6 — Lint + CI (FULL SCOPE)

- Root `pnpm lint` scopes `artifacts/api-server/src/**/*.ts` and `lib/**/*.ts`.
- `pnpm typecheck` passes.

### Execution lifecycle — 5–8 daily tasks (2026-05-27)

| Item | Status |
|------|--------|
| `CONDITION_TASK_LIMITS` | **DONE** |
| `selectTaskCount` | **DONE** |
| Daily top-up | **DONE** — `DailyCycleWorker` + log idempotency |
| `verify-lifecycle` | **PENDING** — needs live DB |

### Verification commands

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm build
pnpm verify:lifecycle   # requires DATABASE_URL
```
