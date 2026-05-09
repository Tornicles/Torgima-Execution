# Torgima

A deterministic execution operating system for individuals. Torgima converts raw goals into phased blueprints, tracks behavioral performance signals (momentum, consistency, velocity), and enforces an adaptive task system that responds to how well the user is actually executing.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 / proxied at /api)
- `pnpm --filter @workspace/torgima run dev` — run the frontend (port 26136 / proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (lib/db)
- Frontend: React + Vite + Wouter + TanStack Query + Zustand + shadcn/ui
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → lib/api-spec/openapi.yaml)
- Background jobs: pg-boss
- AI: Anthropic Claude via Replit AI Integrations (BHUDHI_MODEL=claude-sonnet-4-6)
- Build: esbuild (CJS bundle)

## Where things live

```
lib/api-spec/openapi.yaml           → Single source of truth for all API contracts
lib/api-client-react/src/generated/ → Generated React Query hooks (auto-generated)
lib/api-zod/src/generated/          → Generated Zod schemas (auto-generated)
artifacts/api-server/src/
  app.ts                            → Express app setup
  index.ts                          → Server entry point
  routes/                           → Route handlers (me, blueprints, orders, feedback, signals, state, bhudhi, validation)
  engines/                          → Core computation engines (19 stubs as of Prompt 1)
  services/                         → Business logic layer
  bhudhi/                           → AI intelligence layer (BhudhiCore, TriggerRouter)
  workers/                          → pg-boss worker registry
  types/                            → TypeScript interfaces
  constants/                        → Domain rules, signal thresholds, conditions
artifacts/torgima/src/
  App.tsx                           → React router + providers
  pages/                            → Page components
  store/                            → Zustand stores (blueprint, task, signal, ui)
```

## Architecture decisions

- **In-memory stubs in Prompt 1**: All services use Map<> for storage. Drizzle DB integration happens in Prompt 3.
- **Bhudhi = Claude**: All AI calls go through `BhudhiCore.ts`. No engine or service calls Anthropic directly (except ValidationEngine which delegates to BhudhiCore internally).
- **Condition enforcement is synchronous gate**: Condition code (optimal/building/recovering/critical/blocked) is determined by SignalCalculationEngine, and the ControlEngine enforces it — no route can bypass it.
- **pg-boss for background work**: All async work (signal recalculation, task generation) is enqueued via pg-boss, not handled inline during HTTP requests.
- **Routes return API responses via `success()` / `handleError()`**: Never raw `res.json()` in route handlers.
- **Demo user in Prompt 1**: Auth not yet implemented. All routes use `UserService.getDemoUser()` for the demo user `demo-user-001`. Auth comes in Prompt 2.
- **Prompt 2 complete**: Full 58-table Drizzle ORM schema pushed to PostgreSQL. 6 partial unique indexes, 11 updated_at triggers, seed data (14 feature flags, 3 dev users, 10 global knowledge objects) applied and verified.
- **Prompt 4 complete**: BlueprintEngine (full cold-start 11-step transaction), DomainResolutionEngine (Phase 1 domain rules), BlueprintRepository, BlueprintService (DB-backed), blueprint/onboarding/state/health routes (real auth via requireAuth), DashboardService (real user lookup), OpenAPI spec updated (BlueprintCreateResult, BlueprintActivateResult), codegen regenerated, full typecheck clean.

## Product

Torgima executes on the principle that most people fail not because they lack goals, but because they lack a system that adapts to their real performance. The product:
- Structures raw goals into phased blueprints with Bhudhi (Claude AI)
- Tracks three behavioral signals: momentum, consistency, velocity
- Maps signals to a Condition (optimal/building/recovering/critical/blocked)
- Enforces what kind of work you can do based on your Condition
- Adapts task difficulty and volume to your actual execution capacity
- Detects patterns via feedback interrogation to surface real blockers

## User preferences

- No emojis in code or UI unless explicitly specified
- All server logging via `req.log` (routes) and `logger` (elsewhere) — never `console.log`
- All engine files use `TODO (Prompt N+)` comments to indicate stub status
- In-memory stores for Prompt 1, database in Prompt 3
- `knowledge_objects.id` is `text` type (not UUID) to support descriptive string IDs for global knowledge objects

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any change to `lib/api-spec/openapi.yaml`
- Never rename the OpenAPI `info.title: Api` — it controls generated filenames
- pg-boss `ConstructorOptions` does NOT include `deleteAfterSeconds` (that's a `QueueOptions` property)
- `WorkHandler` in pg-boss v12 receives `Job<T>[]` (array), not a single job
- After any `drizzle-kit push` that recreates tables, re-run `psql $DATABASE_URL -f scripts/apply-partial-indexes.sql` to restore the 6 partial unique indexes
- `pnpm --filter @workspace/db run seed` is idempotent (safe to re-run; uses onConflictDoNothing / onConflictDoUpdate)
- `pnpm --filter @workspace/db run verify` runs all 8 Prompt 2 database verification checks

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Engine stubs numbered by prompt: `TODO (Prompt 5+)` means fully implemented in Prompt 5
