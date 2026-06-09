# AUDIT CLOSURE — 2026-05-27

## TORGIMA Super Admin Dashboard (2026-06-02)

Per `TORGIMA_ADMIN_DASHBOARD.docx`:

- DB: `admin_sessions`, `admin_support_notes`, `admin_actions_log` — `lib/db/src/schema/adminTables.ts`, migration `20260602140000_admin_tables.sql`
- Auth: `AdminAuthService` (separate `admin_session` cookie, 8h TTL) — env `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`
- API: `artifacts/api-server/src/routes/admin.ts` mounted at `/api/admin`
- UI: `artifacts/torgima/src/admin/` — dark theme app at `/admin/*` (dashboard, users, health, analytics, Bhudhi, DLQ, audit)
- Gate: `artifacts/torgima/src/__tests__/unit/admin-dashboard.test.ts`

## DOC 37 — Error handling & edge case testing (2026-06-02)

Per `TORGIMA_DOC37_ERROR_HANDLING.docx` / `DOC_37_Error_Handling_Edge_Case_Testing_Guide.docx`:

- Taxonomy: `artifacts/api-server/src/lib/failure-taxonomy.ts` — seven classes on API `error.class`
- Payload guard: `feedback-payload-limit.ts` (10 KB) on `POST /orders/:id/feedback`; `ACTIVATION_FAILED` on incomplete launch
- Frontend: `feedback-draft.ts`, `useNetworkResilience`, `refetchOnWindowFocus`, offline banner on `FeedbackForm`
- Tests: `artifacts/api-server/src/tests/e2e/doc37/` (6 API suites) + `artifacts/torgima/tests/e2e/doc37/errors.frontend-resilience.spec.ts`
- Gate: `artifacts/torgima/src/__tests__/unit/doc37-error-handling.test.ts`; `pnpm test:doc37` → `scripts/run-doc37-e2e.mjs`

## DOC 36 — End-to-end loop testing (2026-06-02)

Per `TORGIMA_DOC36_E2E_TESTING.docx` / `DOC_36_End_to_End_Loop_Testing_Specification.docx`:

- Integration: `artifacts/api-server/src/tests/e2e/doc36/` — full loop, engine rules, DB integrity
- Helpers: `doc36-reset.ts`, `doc36-loop-runner.ts` (15s budget), `doc36-constants.ts`
- Scripts: `scripts/doc36-reset-test-user.ts`, `scripts/run-doc36-e2e.mjs`; `pnpm test:doc36`
- Playwright: `artifacts/torgima/tests/e2e/doc36/loop.spec.ts`
- Structural gate: `artifacts/torgima/src/__tests__/unit/doc36-e2e-loop.test.ts`

## DOC 35 — Signal, condition & identity panel (2026-06-02)

Per `TORGIMA_DOC35_SIGNAL_CONDITION_PANEL.docx` / `DOC_35_Signal_Condition_Identity_Panel.docx`:

- `/signals` reads shared `useDashboardProjection` only (no parallel signal API calls)
- Components: `StateFreshnessBadge`, `ConditionPanel`, `SignalMetricsPanel`, `IdentityPanel`, `ExplainStateDrawer`, `PanelSkeleton`
- `lib/signals-panel.ts` maps verified dashboard projection to plain-language panels; identity stages via `LANGUAGE.identity`
- Bhudhi explain: `POST /api/bhudhi/explain-state` via `api/bhudhi.ts` with safe fallback copy
- Tests: `artifacts/torgima/src/__tests__/unit/doc35-signals-panel.test.ts`

## DOC 34 — Task execution & feedback screens (2026-06-02)

Per `TORGIMA_DOC34_TASK_FEEDBACK_SCREENS.docx` / `DOC_34_Task_Execution_Feedback_Screens.docx`:

- API: `GET /api/orders/:id` returns `stateVersion` + `taskExecution` (`buildTaskExecutionView`)
- Components: `TaskSkeleton`, `BlockedTaskState`, `ProofRequirement`, `ProofInputs`, `OptionalEffortInputs`, `FeedbackForm`
- Pages: `/tasks/:orderId` and `/feedback/:orderId` load order detail, blocked state without form, feedback via `runDashboardMutation` with stable `idempotencyKey` per order session
- Proof: TEXT 20 chars, FILE upload, LINK, CHECKLIST, OUTPUT client validation
- Tests: `artifacts/torgima/src/__tests__/unit/doc34-task-feedback.test.ts`

## DOC 33 — Dashboard & control panel (2026-06-02)

Per `TORGIMA_DOC33_DASHBOARD_SCREENS.docx` / `DOC_33_Dashboard_Control_Panel_Screens.docx`:

- API: `locked`, `lockReason`, `conditionLabel`, `blueprintId`, `currentAction.allowedActions` on dashboard projection
- Shell states: loading skeleton, NO_BLUEPRINT → onboarding, LOCKED, PENDING_SYNC (5s poll), ACTIVE
- Components: `DashboardShell`, `CurrentActionPanel`, `SystemStateStrip`, `HealthLockState`, banners, `ActionButtons`
- Condition-aware: reduced motion during danger/urgency
- Tests: `artifacts/torgima/src/__tests__/unit/doc33-dashboard-screens.test.ts`

## DOC 32 — Onboarding & goal input screens (2026-06-02)

Per `DOC_32_Onboarding_Goal_Input_Screens.docx` / `TORGIMA_DOC32_ONBOARDING_SCREENS.docx`:

- API: `GET /api/onboarding/status` returns `hasActiveBlueprint`, `onboardingStep`; `POST /api/onboarding/configure-tier` (tier/mode before launch)
- Flow: welcome → goal → context → **structure** (Bhudhi + clarification fallback) → review → validation → tier → activate
- Guard: `useOnboardingActiveBlueprintGuard` on onboarding routes
- Launch: tier card → `configureOnboardingTier`; footer → `selectTierAndLaunch` (idempotent, disabled while pending)
- Copy: `LANGUAGE.onboarding` placeholders and “Start My Execution System” activation label
- Tests: `artifacts/torgima/src/__tests__/unit/doc32-onboarding-screens.test.ts`

## DOC 31 — Frontend architecture & state sync (2026-06-02)

Per `TORGIMA_DOC31_FRONTEND_ARCHITECTURE.docx` / `DOC_31_Frontend_Architecture_State_Sync.docx`:

- Typed API layer: `artifacts/torgima/src/api/*` (credentials, 401 → login, idempotency/state version headers)
- Stores: `sessionStore`, `dashboardStore`, `onboardingStore`
- Hooks: `useSessionGuard`, `useDashboardProjection` (15s poll when `pendingSync`, invalidate map)
- Sync: `lib/query-keys.ts`, `lib/mutations.ts` (`runDashboardMutation`, `afterMutationSuccess`, stale/auth)
- UI safety: `ErrorBoundary` on protected routes; `lib/language.ts` internal-term labels
- Shared client: `lib/api-client-react/src/custom-fetch.ts` — 401 redirect on protected paths
- Wired: `DashboardFeedbackForm`, `pages/feedback.tsx` post-mutation invalidation
- Tests: `artifacts/torgima/src/__tests__/unit/doc31-frontend-architecture.test.ts` (7 passing)
- Gates: `pnpm typecheck`, `pnpm -F torgima build` pass

## Erector validation upgrade (2026-06-01)

Structured validation panels + launch bridge:

- Migration: `scripts/migrations/manual-20260601-erector-validation-upgrade.sql` (9 tables: `validation_runs`, `validation_at_a_glance`, `validation_market_trends`, `validation_competitors`, `validation_pros_cons`, `validation_opportunities`, `validation_risks`, `validation_paths`, `validation_bhudhi_research_log`)
- API: `POST/GET /api/erector/validation/*` (`artifacts/api-server/src/routes/erectorValidation.ts`)
- Engine: `ValidationResearchEngine` runs full `runErectorValidation` (Bhudhi web-search Erector triggers) then syncs panels via `syncValidationRunPanels.ts`
- Bridge: `ValidationBridgeService.launchBlueprint` → `ValidationLaunchService` / `BlueprintLaunchService`
- Worker: `ValidationResearchWorker` on queue `validation_run_requested`
- Frontend: `pollValidationRunStatus` + `ValidationRunningDashboard` pipeline status mapping

Apply on production: `pnpm db:apply-manual` (includes new SQL when added to apply-all list) or run the SQL file directly on Supabase.

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

### Production API smoke (historical — 2026-06-01)

| Endpoint | Result |
|----------|--------|
| `GET https://api.torgima.com/health` | verify after each deploy |
| `GET .../api/health` | `degraded` when signals stale — `database: ok`, `workers: ok`, `bhudhi: ok` |

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
- [ ] Confirm `https://api.torgima.com/health` after deploy

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
| Cloudflare deploy (`deploy-cloudflare.yml`) | `pnpm db:migrate` → `pnpm db:apply-manual` |
| GitHub Phase 9 E2E (was) | `push-force` only, or `migrate` on empty DB (fails) |
| API boot preflight (was) | Full Erector column check → `process.exit(1)` |

**Symptoms:** Magic link “network error” (API never listened), Phase 9 E2E 42703 / missing columns, unit test `phase6-prompt` failures on standalone word `task` in UI copy.

**Fixes (2026-05-22):**

- CI Phase 9 job uses `pnpm db:ci` (`push-force` + `apply-manual`) for **empty** Postgres; production deploy keeps `migrate` + `apply-manual` on **existing** Supabase DBs.
- Boot preflight: `BOOT_CRITICAL_COLUMNS` only blocks start; Erector columns warn (`fe875e1`).
- `FirstWeekPlanPanel.tsx`: execution-language compliant copy (`Order` not `task`).
- `vitest.setup.ts`: unit runs always use `torgima_vitest_stub` URL so local `.env` cannot hijack CI-style unit jobs.

## Manual action

- Production Supabase: run `pnpm db:migrate` and `pnpm db:apply-manual` (use `DIRECT_URL` for DDL when needed).
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
