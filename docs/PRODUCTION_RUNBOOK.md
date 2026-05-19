# Prompt 15 Production Runbook

Prompt 15 is the production deployment and handoff pass for Torgima Phase 1. This repo is a Vite SPA plus a long-running Express API/workers service, so the deployment flow adapts the prompt's Next.js examples to the actual architecture.

## Pre-Deployment Checklist

- Branch: production deploys from `main`; verify with `git branch --show-current` and the Vercel production branch setting.
- Node: `.node-version` is present at repo root and pins `22.13.0`.
- Build order: root `vercel.json` builds `@workspace/api-client-react` before `@workspace/torgima`.
- Environment: production hosts have `NODE_ENV=production`, `APP_VERSION=phase1`, and no test data generator enabled.
- Database: use an alphanumeric-only Supabase password in connection URLs to avoid URL parsing failures.
- Schema: run Drizzle schema sync and manual SQL scripts against production before first boot.
- Platform references: production TypeScript paths must not depend on local-only URLs or development-only APIs.
- Fallbacks: Bhudhi fallback tests must pass with `ANTHROPIC_API_KEY` removed.
- pg-boss: `PGBOSS_DATABASE_URL` may be set separately; otherwise workers use `DATABASE_URL`.
- Health: `/api/health` must return either `healthy` or `degraded` with database, Bhudhi, workers, and signals checks.

## Required Production Environment

### Frontend (Vercel)

- `VITE_API_BASE_URL=https://api.torgima.com`
- `VITE_APP_VERSION=phase1`

### API + Workers

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

   `db:migrate:prod` runs Drizzle migrations from the committed `migrations/` folder. Do not use `drizzle-kit push` or ad hoc SQL patch scripts in production. On Railway, confirm `DATABASE_URL` points at the same Supabase Postgres instance used by the API and set `DIRECT_URL` for direct migration access if the pooled URL blocks DDL.

3. Build locally:

   ```bash
   pnpm run typecheck
   pnpm run build
   pnpm -F @workspace/api-server exec vitest run src/tests/unit/bhudhi/phase11-prompt.test.ts src/tests/unit/bhudhi/phase12-prompt.test.ts src/tests/unit/bhudhi/phase13-prompt.test.ts src/tests/unit/bhudhi/phase14-prompt.test.ts src/tests/unit/bhudhi/phase15-prompt.test.ts
   ```

4. Deploy frontend:

   ```bash
   vercel --prod
   ```

5. Deploy API/workers on the long-running Node host:

   ```bash
   pnpm --filter @workspace/api-server build
   pnpm --filter @workspace/api-server start
   ```

6. Post-deployment verification:

   ```bash
   curl -fsS https://torgima.com
   curl -fsS https://api.torgima.com/api/health
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

- Vercel Analytics: enable for the public SPA; alert when P95 page load or API proxy timing exceeds 5 seconds.
- API health: monitor `/api/health` every 5 minutes; alert on 2 consecutive degraded responses.
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
