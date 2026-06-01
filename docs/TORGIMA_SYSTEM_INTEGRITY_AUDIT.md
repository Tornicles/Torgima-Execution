# TORGIMA SYSTEM INTEGRITY AUDIT

**Audit date:** 2026-05-27  
**Scope:** Full read of repo structure, engines, workers, routes, schema, and execution-loop tracing (static analysis + existing completeSystemDiagnostic.ts + targeted file reads).

**Note:** The audit template referenced Prisma/Next.js App Router paths. The actual stack is documented in docs/AUDIT_LOG.md and TORGIMA_COMPLETE_DIAGNOSTIC_REPORT.md.

---

## Stack mapping (template vs actual)

| Template expectation | Actual repository |
|---------------------|-------------------|
| Next.js 14 App Router + src/app/api/ | Vite/React SPA (artifacts/torgima) + Express 5 API (artifacts/api-server/src/routes/) |
| Prisma + prisma/schema.prisma | Drizzle (lib/db/src/schema/*.ts) |
| src/lib/prisma.ts | @workspace/db pool + Drizzle (lib/db/src/index.ts) |
| src/bhudhi/* | artifacts/api-server/src/bhudhi/* |
| src/engines/execution-loop/*Engine.ts | engines/feedback, signal, condition, control, task-generation, task-guarantee |
| NextAuth.js v5 | Custom magic-link (AuthService, sessions, cookie torgima_session) |
| 42 tables in Prisma | 348 pgTable definitions; Phase-1 core ~46 tables in completeSystemDiagnostic REQUIRED_TABLES |

---

## CRITICAL BREAKS (execution loop cannot function)

| # | File | Exact issue | Law / impact |
|---|------|-------------|--------------|
| C1 | artifacts/api-server/src/routes/feedback.ts:308-327 | POST /api/feedback/task calls FeedbackService.submit only — no FEEDBACK_SUBMITTED / outbox event | Legacy clients never enter feedback→signal→condition→enforcement→task chain |
| C2 | Production DB (operational) | bhudhi_logs had no CREATE TABLE in manual migrations until manual-20260601-bhudhi-log-repair.sql; if not applied, Bhudhi logging fails (code now fail-open in BhudhiCore.ts) | Usage caps & audit trail broken; AI may run without logs |
| C3 | Production DB (operational) | bhudhi_signals ALTER in manual-20260528-structured-feedback.sql fails if table missing; repair in manual-20260601-missing-tables-repair.sql must be applied | Structured feedback / signal persistence warnings |
| C4 | docs/AUDIT_LOG.md:64 | scripts/apply-partial-indexes.sql exists but is manual — if not run on Supabase, is_current uniqueness is not enforced | Race / duplicate current rows possible under concurrency |

**Note:** The primary production path POST /api/orders/:id/feedback → processFeedback() → outbox is CONNECTED. C1 is critical only for clients still on the legacy route.

---

## BROKEN CHAINS (events not connected)

| Handoff | Status | Evidence |
|---------|--------|----------|
| POST /api/orders/:id/feedback → full loop | CONNECTED | orders.ts:346-364, FeedbackProcessingEngine.ts:305-326, eventContracts.ts, workers/start.ts |
| POST /api/feedback/submit (structured) → FeedbackWorker | PARTIAL | StructuredFeedbackService.ts:365-378; FeedbackWorker skips psychology/friction without feedback_id; SIGNAL_RECALCULATION still emitted |
| POST /api/feedback/task (legacy) | BROKEN | feedback.ts:308-327 — no event emission |
| feedback.ts weekly review / phase checkpoint | BROKEN (shortcut) | Emits task_generation_requested directly — bypasses signal→condition→control |
| EnforcementPackageGenerator in loop | N/A (stub) | Live path uses ControlEngine.generateEnforcementPackage |

---

## ARCHITECTURAL VIOLATIONS

| File / area | Violation | Per spec | Actual |
|-------------|-----------|----------|--------|
| Repo root | Stack mismatch | Prisma + Next App Router | Drizzle + Express + Vite |
| prisma/schema.prisma, src/app/api/** | Missing | Required | Does not exist |
| ~40 route modules | Direct DB in routes | Services only | @workspace/db inline queries |
| feedback.ts, internal.ts | Bhudhi from routes | Engines only | routeBhudhiRequest from TriggerRouter |
| TriggerRouter.ts | Anthropic SDK | Only BhudhiCore | By design (B1): sole messages.create site |
| ErectorOrchestrationService.ts | console.log | logger | 2× console.log in engines |
| boot.ts, queue.ts | console | logger | Startup / pg-boss paths |
| Auth | NextAuth | NextAuth v5 | AuthService + sessions |
| MemoryManager.ts | Missing | Tier depth | BhudhiMemoryService, memoryPolicy, ContextBuilder |
| bhudhi/prompts/ | Missing dir | Prompt files | PromptRegistry, FallbackLibrary |
| MilestoneWorker, SystemHealthWorker | Missing names | Workers | RewardWorker, HealthWorker |
| npm run lint | Missing script | Zero lint errors | Not in root package.json |

---

## MISSING FILES (template paths)

- prisma/schema.prisma → lib/db/src/schema/tables.ts (+ siblings)
- src/lib/prisma.ts → lib/db/src/index.ts
- src/lib/queue.ts → artifacts/api-server/src/lib/queue.ts
- src/lib/errors.ts → artifacts/api-server/src/lib/errors.ts
- src/lib/logger.ts → artifacts/api-server/src/lib/logger.ts
- src/lib/anthropic.ts → artifacts/api-server/src/lib/anthropic.ts
- src/types/api.ts → artifacts/api-server/src/types/api.ts
- src/app/api/** → artifacts/api-server/src/routes/**
- execution-loop/*Engine.ts paths → engines/feedback, signal, condition, control, task-generation, task-guarantee
- MemoryManager.ts → BhudhiMemoryService.ts
- prisma/seed.ts → lib/db/src/seed.ts
- MilestoneWorker.ts → RewardWorker.ts
- SystemHealthWorker.ts → HealthWorker.ts

---

## SCHEMA ISSUES

- 348 Drizzle tables total; Phase-1 core ~46 in REQUIRED_TABLES (0 missing in schema per static audit).
- bhudhi_logs: repair in manual-20260601-bhudhi-log-repair.sql — must be applied on production.
- bhudhi_signals: repair in manual-20260601-missing-tables-repair.sql.
- order_status.queued: repair in manual-20260601-missing-tables-repair.sql.
- scripts/apply-partial-indexes.sql: all 6 indexes present in repo; DB application not verified in static audit.

---

## TYPE ERRORS

- pnpm typecheck passes on current main.
- No project-wide npm run lint — criterion not measurable without adding ESLint.

---

## WARNINGS (non-critical)

1. EnforcementPackageGenerator.ts — stub/TODO
2. Structured feedback: FeedbackWorker skips branches without feedback_id
3. feedback.ts weekly/phase paths skip full loop
4. state_version bumps in workers, not all engines directly
5. Mix of success()/failure() vs raw res.json in some routes
6. .env.example gaps (NEXTAUTH vs SESSION_SECRET)
7. Bhudhi memory tier labels not explicit session/7d/30d
8. console.log in Erector / seed scripts
9. Production env keys may be unset locally
10. db:apply-manual + apply-partial-indexes.sql required per environment

---

## VERIFIED WORKING

- TorgimaError, ApiResponse<T>, pino logger, pg-boss singleton
- WorkerRegistry + 31 workers via workers/start.ts
- BaseWorkerHandler: idempotency, event_logs, dead_letter_events
- Primary execution loop event map (eventContracts.ts)
- is_current transactional flips in Signal, Condition, Control engines
- TaskGenerationEngine reads enforcement_packages (throws if missing)
- TriggerRouter: checkTriggerAllowed, checkUsageAllowed
- OutputValidator in BhudhiCore; fallbacks via FallbackLibrary
- Anthropic SDK only in TriggerRouter.ts
- Partial indexes script complete (6 indexes)
- Feature flags seed in lib/db/src/seed.ts
- POST /api/v1/onboarding/select-blueprint launch route

---

## COMPLETION CRITERIA SCORECARD

| # | Criterion | Result |
|---|-----------|--------|
| 1 | tsc --noEmit → 0 errors | PASS (pnpm typecheck) |
| 2 | npm run lint → 0 errors | FAIL — no lint script |
| 3 | Execution loop traceable | PASS primary; FAIL legacy/shortcuts |
| 4 | 42 tables in prisma/schema | N/A — Drizzle, ~46 core OK |
| 5 | apply-partial-indexes.sql (6) | PASS file; UNKNOWN DB |
| 6 | No route direct DB | FAIL — widespread |
| 7 | No route direct Anthropic | PASS |
| 8 | Enforcement null-check | PASS TaskGenerationEngine |
| 9 | Bhudhi fallbacks | PASS |
| 10 | WorkerRegistry complete | PASS |

---

## TOTALS

| Category | Count |
|----------|-------|
| Critical breaks | 4 |
| Broken / partial chains | 3 |
| Architectural violations | 15+ |
| Missing files (template paths) | 18 path groups |
| Schema issues | 5 |
| Type errors (compile) | 0 |
| Warnings | 10 |

---

## Recommended Phase 3 fix order

1. P1: Wire or remove POST /api/feedback/task; fix weekly/phase shortcuts.
2. P2: Run pnpm db:apply-manual + apply-partial-indexes.sql on production.
3. P3: Move route-level Drizzle to services.
4. P4: Bhudhi log monitoring; structured feedback payload alignment.
5. P5: Worker audit (already strong); add lint CI.
6. P6: Add pnpm lint and enforce zero errors.

*Generated from Torgima Execution OS codebase audit — Phase 2 report only; repairs not included.*
