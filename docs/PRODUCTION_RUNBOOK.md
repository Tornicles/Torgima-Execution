# Prompt 15 Production Runbook

Prompt 15 is the production deployment and handoff pass for Torgima Phase 1. Production runs on **Cloudflare Pages** (frontend) and **Cloudflare Workers** (API). Cloudflare + Supabase only.

## Pre-Deployment Checklist

- Branch: production deploys from `main`; verify GitHub Actions **Deploy to Cloudflare** succeeded.
- Node: `22` (see root `package.json` engines).
- Build: `pnpm build:cloudflare:pages` for frontend; Worker deploy via `artifacts/api-server/wrangler.toml`.
- Environment: Worker has `NODE_ENV=production`, `TORGIMA_RUNTIME=cloudflare`, `APP_URL=https://torgima.com`.
- Database: Supabase via `DATABASE_URL` on Worker; run `pnpm db:migrate` + `pnpm db:apply-manual` before launch.
- Health: `GET https://api.torgima.com/health` must return JSON with status checks (not generic 500).
- **Platform references:** production code and config must point at the approved Cloudflare architecture — frontend `https://torgima.com`, API `https://api.torgima.com`, Worker route `api.torgima.com/*`, Supabase for database/auth, Resend for email, Anthropic for AI, KV `SESSIONS` for sessions. `workers.dev` is CI health probes only, not a public API URL.
- **Fallbacks:** Bhudhi fallback tests must pass with `ANTHROPIC_API_KEY` removed.
- **pg-boss:** on long-running Node hosts, `PGBOSS_DATABASE_URL` may be set separately; otherwise pg-boss uses `DATABASE_URL`. Production Cloudflare Worker does not run pg-boss — use Worker cron triggers and optional Cloudflare Queues (`torgima-task-queue`) instead.
- **Worker schedulers:** verify wrangler cron triggers are deployed; alert if the overnight cycle does not complete within 2 hours of schedule.

## Three Laws production audit

Before every production promotion, confirm:

- **Law 1:** no system action harms user execution or corrupts production state.
- **Law 2:** automation stays bounded by validated user intent and production permissions.
- **Law 3:** platform references, secrets, routes, and execution paths match the approved production architecture.

### Platform references

- Frontend must reference `https://torgima.com` (Cloudflare Pages project `torgima-execution`).
- Frontend API base must reference `https://api.torgima.com`.
- Worker route must be `api.torgima.com/*`.
- Supabase is the production database/auth source (`DATABASE_URL`, Supabase keys).
- Resend is the production email provider (`RESEND_API_KEY`, `EMAIL_FROM`).
- Anthropic is the production AI provider (`ANTHROPIC_API_KEY`).
- `workers.dev` must not be the public production API (CI health probes only).

## Required Production Environment

### Frontend (Cloudflare Pages — project `torgima-execution`)

- `VITE_API_BASE_URL=https://api.torgima.com`
- `VITE_APP_VERSION=phase1`

### API (Cloudflare Worker — `torgima`)

- `DATABASE_URL`
- `DIRECT_URL`
- `PGBOSS_DATABASE_URL` (optional; falls back to `DATABASE_URL`)
- `ANTHROPIC_API_KEY`
- `BHUDHI_MODEL`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `EMAIL_FROM`
- `NOTIFICATION_UNSUBSCRIBE_SECRET`
- `INTERNAL_AUTH_SECRET`
- `FRONTEND_URL=https://torgima.com`
- `APP_VERSION=phase1`
- `PORT`
- `NODE_ENV=production`

## Deployment Sequence

1. Sync `main`:

   ```bash
   git branch --show-current
   git pull origin main
   ```

2. Apply production schema:

   ```bash
   pnpm run db:check
   pnpm run db:migrate:prod
   pnpm -F @workspace/db verify
   ```

   `db:migrate:prod` runs Drizzle migrations from the committed `migrations/` folder. Do not use `drizzle-kit push` or ad hoc SQL patch scripts in production. Confirm `DATABASE_URL` (GitHub secret / Worker secret) points at the same Supabase Postgres instance used by the API. Set `DIRECT_URL` for direct migration access if the pooled URL blocks DDL.

3. Build locally:

   ```bash
   pnpm run typecheck
   pnpm run build
   pnpm -F @workspace/api-server exec vitest run src/tests/unit/bhudhi/phase11-prompt.test.ts src/tests/unit/bhudhi/phase12-prompt.test.ts src/tests/unit/bhudhi/phase13-prompt.test.ts src/tests/unit/bhudhi/phase14-prompt.test.ts src/tests/unit/bhudhi/phase15-prompt.test.ts
   ```

4. Deploy (preferred — CI):

   Push to `main` or run **Deploy to Cloudflare** workflow manually. It runs migrations, deploys Worker `torgima`, and Pages project `torgima-execution`.

5. Deploy manually (if needed):

   ```bash
   pnpm run build:cloudflare:pages
   pnpm run deploy:cloudflare:pages
   pnpm --filter @workspace/api-server exec wrangler deploy
   ```

   Set Worker secrets via `wrangler secret put` before manual deploy (see `docs/CLOUDFLARE_MIGRATION.md`).

6. Post-deployment verification:

   ```bash
   curl -fsS https://torgima.com
   curl -fsS https://api.torgima.com/health
   curl -fsS https://api.torgima.com/api/health
   curl -fsS https://api.torgima.com/api/debug/blueprint-launch-health
   curl -I https://torgima.com/og-image.png
   ```

## Health Endpoint Contract

`GET /api/health` returns direct JSON for external monitoring:

```json
{
  "status": "healthy",
  "timestamp": "2026-05-19T00:00:00.000Z",
  "checks": {
    "database": "ok",
    "bhudhi": "ok",
    "workers": "ok",
    "signals": "ok"
  },
  "version": "phase1",
  "metrics": {
    "pendingEvents": 0,
    "deadLetters": 0,
    "healthIssues": 0,
    "latestSignalAgeHours": null
  }
}
```

External monitoring should ping this endpoint every 5 minutes and alert on consecutive `503` responses.

## Monitoring Setup

- Cloudflare Pages analytics: enable for the public SPA; alert when P95 page load exceeds 5 seconds.
- API health: monitor `GET https://api.torgima.com/health` and `GET /api/health` every 5 minutes; alert on 2 consecutive degraded responses.
- Blueprint launch: after each migration, run a staging smoke test for validation -> launch -> dashboard and confirm `POST /api/blueprints/:id/activate` creates plans, targets, phases, projects, actions, orders, `signal_snapshots`, `conditions`, `enforcement_packages`, and `state_memory`.
- System health: `SystemHealthEngine` runs through production schedulers and records DLQ size, fallback rate, stale users, and signal lag.
- Error tracking: configure Sentry or equivalent for API unhandled errors, rejected Bhudhi outputs, and failed worker jobs.
- Database: monitor Supabase connection pool usage, slow queries over 1 second, and failed auth/connection attempts.
- Overnight worker: alert if the overnight cycle does not complete within 2 hours of schedule.
- EIS rate limits: alert if more than 10 users hit EIS limits simultaneously.
- Anthropic: alert if Bhudhi fallback usage exceeds 20%; treat 50% as critical.

## Backup Strategy

Critical tables must be protected by Supabase backups and restore drills:

- `signal_snapshots`
- `conditions`
- `feedback`
- `orders`
- `blueprints`, `plans`, `phases`, `projects`, `actions`
- `users`

Recoverable tables can be recomputed from critical data:

- world model records
- Bhudhi memory
- EIS intelligence records
- dashboard intelligence snapshots

Monthly restore drill:

1. Download the latest Supabase backup.
2. Restore to staging.
3. Run `pnpm run typecheck`, `pnpm run test:unit`, and the onboarding smoke test against staging.
4. Verify critical table counts and recent records.

## Phase 2 Readiness Thresholds

Phase 2 should wait for real execution data:

- 50 active users with at least 7 days of execution.
- 500 completed primary loop cycles.
- 100 burnout records.
- 14 days of signal history for at least 30 users.
- 50 failure classifications.
- 2 full weeks of overnight worker runs for at least 20 users.
- 20 completed Academy learning paths.
- 10 pattern records per user for at least 20 users.

Phase 2 preview: identity evolution, motivation and meaning, cognitive load, attention protection, emergence detection, proactive initiative, goal evolution, friction topology, full debate loop, and full Psychology Agent activation.
