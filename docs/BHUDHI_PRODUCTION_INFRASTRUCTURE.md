# BHUDHI Production Infrastructure (Prompt 37)

Production-grade deployment, monitoring, rate limiting, and backup for Bhudhi 2.0 in Torgima-Execution.

**Stack (this repo):**

| Layer | Host |
|-------|------|
| Frontend SPA | Vercel (`artifacts/torgima`) |
| API + pg-boss workers | Railway / Fly / Render (long-running Node) |
| Database | Supabase PostgreSQL |
| Queue | pg-boss (same Postgres) |
| Rate limit | In-memory (optional `REDIS_URL` reserved) |
| Logging | Pino (`artifacts/api-server/src/lib/logger.ts`) |

## Certification (Prompt 38)

```bash
curl https://<api>/api/bhudhi/certification
```

See [BHUDHI_CERTIFICATION.md](./BHUDHI_CERTIFICATION.md) for BRS tiers and benchmarks.

See also: [DEPLOYMENT.md](./DEPLOYMENT.md) · [BHUDHI_OS_SPEC.md](./BHUDHI_OS_SPEC.md) · [BHUDHI_CERTIFICATION.md](./BHUDHI_CERTIFICATION.md)

---

## Deploy checklist

1. Apply Drizzle migrations through `0029` on production Postgres.
2. Run supplemental indexes: `psql $DATABASE_URL -f scripts/db-setup.sql`
3. Configure API host from `artifacts/api-server/.env.production.example`
4. Set Vercel `VITE_API_BASE_URL` to the API origin (no trailing slash).
5. Probe `GET /api/health` and `GET /api/bhudhi/monitoring/health`
6. Open `/app/bhudhi/monitoring` in the SPA

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/migrate-production.sh` | Backup (if `pg_dump` present) + `pnpm db:migrate` + `db-setup.sql` |
| `scripts/backup-production.sh` | `pg_dump` + gzip, retain 30 days |
| `scripts/db-setup.sql` | Supplemental indexes for kernel, memory, protocol, runtime |

```bash
export DATABASE_URL=postgresql://...
./scripts/migrate-production.sh
```

---

## Health endpoints

| Endpoint | Scope |
|----------|--------|
| `GET /api/health` | Platform: DB, workers, signals, Bhudhi API key |
| `GET /api/healthz` | Liveness (`{ status: "ok" }`) |
| `GET /api/bhudhi/health` | Catalog seed (systems/engines count) |
| `GET /api/bhudhi/monitoring/health` | Deep Bhudhi layers (kernel, memory, runtime, catalog) |
| `GET /api/metrics` | Combined platform + Bhudhi metrics |
| `GET /api/bhudhi/monitoring/metrics` | Same bundle in Bhudhi envelope |

Uptime monitors should use **`GET /api/health`** (existing) and optionally **`GET /api/bhudhi/monitoring/health`** after migrations 0026–0029.

---

## Rate limiting

- Middleware: `artifacts/api-server/src/middleware/bhudhiRateLimit.ts`
- Applies to `/api/bhudhi/*` except health, monitoring, consolidation
- Key: `bhudhi:{blueprintId}` from header `x-blueprint-id`, query, or body
- Env: `ENABLE_RATE_LIMITING`, `RATE_LIMIT_REQUESTS` (default 100), `RATE_LIMIT_WINDOW_MS` (default 60000)
- Returns `429` with `RATE_LIMIT_EXCEEDED`

---

## Monitoring dashboard

Universal Bhudhi dashboard section:

- **URL:** `/app/bhudhi/monitoring?blueprintId=<uuid>`
- **Component:** `artifacts/torgima/src/components/bhudhi/universal/sections/MonitoringSection.tsx`
- Polls every 5s: platform health, Bhudhi health, metrics

---

## Environment variables

Copy `artifacts/api-server/.env.production.example` to your host secret store. Critical:

- `DATABASE_URL`, `PGBOSS_DATABASE_URL`
- `ANTHROPIC_API_KEY` (required in production for Bhudhi AI)
- `FRONTEND_URL` (CORS + email links)
- `APP_VERSION=2.0.0`
- `ENABLE_RATE_LIMITING=true`
- `LOG_LEVEL=info`

---

## Vercel

Root `vercel.json` builds **only the SPA**. Do not deploy the API to Vercel. No changes required for Prompt 37 beyond ensuring `VITE_API_BASE_URL` points at the API host.

---

## What is not in this repo

- Dedicated Redis/Upstash package (in-memory limiter used; `REDIS_URL` reserved)
- Sentry/Datadog SDK wiring (env placeholders only; use host APM)
- Prisma (`pnpm db:migrate` uses Drizzle)
