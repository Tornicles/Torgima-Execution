# TORGIMA Runtime Contract

Single source of truth for API routing, health probes, debug auth, event lifecycle, and worker registry expectations. Tests, deploy verifiers, and GitHub Actions must align to this document — not the reverse.

## API routing

`app.ts` mounts the main API router at `/api`:

```ts
app.use("/api", router);
```

`routes/index.ts` mounts subrouters **without** a `/api` prefix. External URLs always include `/api` once.

| Internal mount (`routes/index.ts`) | External URL |
|-----------------------------------|--------------|
| `router.use("/erector", erectorFreeRouter)` | `/api/erector/...` |
| `router.use("/erector", erectorIntakeRouter)` | `/api/erector/...` |
| `router.use("/erector", erectorPaidRouter)` | `/api/erector/...` |
| `router.use("/handoff", handoffRouter)` | `/api/handoff/...` |
| `router.use("/debug", withAuth("INTERNAL_SERVICE"))` | `/api/debug/...` |

**Rules**

- Never register `router.use("/api/erector", ...)` inside `routes/index.ts` (double `/api`).
- Auth, admin, webhooks, and external routers mount at app root as documented in `app.ts`.
- Contract tests: `src/tests/integration/b9-integration-verification.test.ts`.

## Health

| Endpoint | Semantics | Auth | Used by |
|----------|-----------|------|---------|
| `GET /health` | **Liveness** — process is up | Public | `--deploy-only` verifier, load balancers |
| `GET /api/health` | **Readiness** — DB + signals + deep checks | `x-internal-auth` | Full production readiness verifier |

### Liveness (`/health`)

Valid PASS bodies on HTTP 200:

- Boolean `true`
- `{ "ok": true }`
- `{ "status": "healthy" }` or `{ "status": "operational" }`

FAIL: `false`, `{ "ok": false }`, non-200.

Parser: `scripts/production-probe-common.mjs` → `parseHealthLivenessResponse`.

### Readiness (`/api/health`)

Requires `x-internal-auth`. PASS only when HTTP 200, `ok: true`, and `status: "healthy"`.

`ok: false` with HTTP 200 means **deployed but not fully ready** (e.g. database check failing). This must **not** fail `--deploy-only`; it **must** fail full readiness mode.

Parser: `scripts/production-probe-common.mjs` → `parseApiHealthReadinessResponse`.

### Deploy verification modes

| Mode | Flag | Gates |
|------|------|-------|
| Deploy-only | `--deploy-only` | `/health` liveness + `/api/debug/*` with auth |
| Full readiness | (default) | Above + `/api/health` deep readiness |

`workers.dev` 404 → `WORKERS_DEV_ROUTE_404_OPTIONAL` (WARN only when canonical API passes).

Script: `scripts/production-deploy-verify.mjs`.

## Debug routes

Protected by `withAuth("INTERNAL_SERVICE")` on `/debug` subrouter.

| Route | Purpose |
|-------|---------|
| `GET /api/debug/db-target` | Database binding diagnostics |
| `GET /api/debug/bhudhi-runtime` | Bhudhi runtime policy snapshot |

| Caller | Expected |
|--------|----------|
| Browser / no `x-internal-auth` | `403` + `{ error: { code: "FORBIDDEN" } }` |
| GitHub Actions with `INTERNAL_AUTH_SECRET` | `200` + `ok: true` |
| Missing secret in verifier | `INTERNAL_AUTH_SECRET_MISSING` — fail |
| Mismatched secret | `INTERNAL_AUTH_SECRET_MISMATCH` — fail |

Debug routes must remain **non-public**.

## Supabase REST URL (Workers)

`SUPABASE_URL` Cloudflare secret must be the **PostgREST** base URL:

```text
https://<project-ref>.supabase.co
```

**Not** valid for `SUPABASE_URL`:

- `postgresql://...` (that belongs in `DATABASE_URL`)
- `*.pooler.supabase.com` (pooler is for Postgres only)
- `db.<ref>.supabase.co` (auto-corrected to `https://<ref>.supabase.co`)

At Worker bind time, `resolveSupabaseRestBaseUrl` derives the correct REST URL from `DATABASE_URL` project ref when the secret is misconfigured. Health probes fall back to postgres pooler `SELECT 1` if PostgREST DNS fails (Cloudflare error 1016).

## Event lifecycle

Naming convention:

- `*_requested` — intent emitted; queue consumer should pick up
- `*_started` — worker began processing
- `*_completed` — worker finished with result

Source of truth: `artifacts/api-server/src/types/eventContracts.ts` (`EventTypes`, `WorkerQueues`, `EVENT_QUEUE_MAP`).

### Canonical Erector / blueprint mappings

| Event | Queue / routing | Notes |
|-------|-----------------|-------|
| `erector_intake_normalized` | `projection_refresh_requested` | Dashboard/state; does not start validation worker |
| `erector_validation_requested` | `erector_validation_requested` | Starts validation orchestration (`ErectorValidationRequestedWorker`) |
| `erector_validation_started` | `erector_validation_started` | Worker-in-progress marker |
| `erector_baseline_requested` | `erector_baseline` | `ErectorBaselineWorker` |
| `erector_baseline_completed` | `projection_refresh_requested` | State refresh after baseline |
| `blueprint_execution_generation_requested` | `blueprint_execution_generation` | `BlueprintExecutionGenerationWorker` |
| `blueprint_execution_generation_completed` | `projection_refresh_requested` | Post-generation refresh |
| `feedback_submitted` | `feedback_processing_requested` | `FeedbackWorker` |
| `signal_recalculation_requested` | `signal_recalculation_requested` | `SignalWorker` |
| `condition_evaluation_requested` | `condition_evaluation_requested` | `ConditionWorker` |
| `task_generation_requested` | `task_generation_requested` | `TaskGenerationWorker` |

Intake pipeline emits `ERECTOR_INTAKE_NORMALIZED` then `ERECTOR_VALIDATION_REQUESTED` when `validation_ready` (`IntakePipeline.ts`).

## Worker registry

Source: `artifacts/api-server/src/workers/WorkerRegistry.ts` (`WORKER_REGISTRY`).

**Do not assert a fixed total worker count** unless the registry contract intentionally freezes count. Assert required workers by name.

### DOC16 core workers (required)

`FeedbackWorker`, `SignalWorker`, `ConditionWorker`, `ControlWorker`, `TaskGenerationWorker`, `TaskGuaranteeWorker`, `InactivityWorker`, `ProjectionWorker`, `BhudhiWorker`, `HealthWorker`, `ErectorSignalBridgeWorker`, `ErectorSimulationSignalWorker`.

### TORGIMA lifecycle extensions (required)

`ErectorBaselineWorker` — consumes `erector_baseline_requested`.

`BlueprintExecutionGenerationWorker` — consumes `blueprint_execution_generation_requested`.

### Optional / diagnostic

Workers registered only in `WORKER_CATALOG` or pg-boss side paths (e.g. `EventDispatcherWorker`, cron scanners) are operational but not part of `WORKER_REGISTRY` DOC16 snapshot.

Health snapshot (`getWorkerHealthSnapshot`) must include retry metadata for every `WORKER_REGISTRY` entry.

Contract tests: `src/tests/unit/events/event-system-doc16.test.ts`.

## Unit test database isolation

Pure unit tests (`NODE_ENV=test`, `TORGIMA_INTEGRATION` not enabled) use stub `DATABASE_URL`:

```text
postgresql://postgres:postgres@127.0.0.1:5432/torgima_vitest_stub
```

`@workspace/db` returns a fast-fail stub pool — no live Postgres required. Integration tests set `TORGIMA_INTEGRATION=true` with a real `DATABASE_URL`.

Setup: `artifacts/api-server/src/tests/vitest.setup.ts`.

## GitHub Actions alignment

| Workflow job | Contract |
|--------------|----------|
| `CI / Typecheck and build` | `pnpm typecheck` + `pnpm build` |
| `Deploy / Typecheck, build, test` | Full `pnpm test` gate before deploy |
| `Deploy API Worker` | After CI passes; post-deploy `--deploy-only` verifier |
| `Production verification` | Full readiness via `production-prod-verify.mjs` (includes `/api/health`) |

Deploy worker must not treat `workers.dev` 404 as canonical failure when `api.torgima.com` passes.
