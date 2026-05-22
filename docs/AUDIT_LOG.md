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

## Manual action

- Production/Railway: run `pnpm db:migrate` and `pnpm db:apply-manual` (use `DIRECT_URL` for DDL).
- Apply `scripts/apply-partial-indexes.sql` if partial unique indexes are not yet on the database.
- Set `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL` (or `APP_URL`) for outbound magic links in production.
