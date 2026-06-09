# Torgima → Cloudflare production architecture

Infrastructure: **Cloudflare Pages** (frontend) + **Cloudflare Workers** (API) + **Supabase** (database/auth) + **Resend** (email) + **Anthropic** (AI).

Production is **Cloudflare + Supabase only**. Previous Railway/Vercel deploy configs have been removed from the repo.

## Production URLs

| Service | URL |
|---------|-----|
| Frontend | https://torgima.com |
| API | https://api.torgima.com |
| Health | https://api.torgima.com/health |

## Cloudflare dashboard resources

| Resource | Name | Notes |
|----------|------|--------|
| **Pages project** | `torgima-execution` | Build: `pnpm build:cloudflare:pages` → `artifacts/torgima/dist` |
| **Worker** | `torgima` | Route: `api.torgima.com/*` |
| **KV namespace** | `TORGIMA_SESSIONS` | Binding `SESSIONS` in wrangler |
| **Queue** (optional) | `torgima-task-queue` | Uncomment in wrangler after creation |
| **Hyperdrive** (recommended) | `torgima-supabase` | Supabase Postgres connection pooling |

## DNS

| Host | Target |
|------|--------|
| `torgima.com` | Cloudflare Pages |
| `www.torgima.com` | Cloudflare Pages |
| `api.torgima.com` | Worker `torgima` |

## Frontend (Pages)

See **`artifacts/torgima/CLOUDFLARE_PAGES.md`**.

| Field | Value |
|-------|--------|
| Project | `torgima-execution` |
| Build command | `pnpm build:cloudflare:pages` |
| Output | `artifacts/torgima/dist` |
| Env | `VITE_API_BASE_URL=https://api.torgima.com` |

## API (Workers + Express bridge)

- Entry: `artifacts/api-server/src/worker.ts`
- Express via `cloudflare:node` + `handleAsNodeRequest`
- Local dev: `pnpm exec wrangler dev` (port 8787)

## Sessions (KV)

When `SESSIONS` KV binding is present, magic-link verify dual-writes KV + `sessions` table.

## Database (Supabase)

- Worker secret: `DATABASE_URL`
- Optional Hyperdrive binding for connection pooling
- Migrations: `pnpm db:migrate` + `pnpm db:apply-manual`

## Worker secrets

```bash
wrangler secret put DATABASE_URL
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put EMAIL_FROM
wrangler secret put INTERNAL_AUTH_SECRET
wrangler secret put NOTIFICATION_UNSUBSCRIBE_SECRET
```

## CI/CD

`.github/workflows/deploy-cloudflare.yml` — build, migrate, deploy Worker + Pages.

### GitHub secrets

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Deploy Workers + Pages |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID |
| `DATABASE_URL` | Migrations + Worker |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role |
| `ANTHROPIC_API_KEY` | Bhudhi AI |
| `RESEND_API_KEY` | Magic link email |
| `EMAIL_FROM` | Sender address |
| `INTERNAL_AUTH_SECRET` | Internal routes |
| `NOTIFICATION_UNSUBSCRIBE_SECRET` | Unsubscribe tokens |

### GitHub variables

| Variable | Example |
|----------|---------|
| `VITE_API_BASE_URL` | `https://api.torgima.com` |

## Queues / cron

Cron triggers in `wrangler.jsonc` cover scheduled jobs. Optional `torgima-task-queue` replaces pg-boss on Workers.

Node local dev: pg-boss unchanged when `TORGIMA_RUNTIME` is not `cloudflare`.

## Debug routes (no secrets exposed)

- `GET /api/debug/cloudflare-env`
- `GET /api/debug/routes`
- `GET /api/debug/blueprint-launch-health`

## Rollback

Prefer Cloudflare dashboard rollback (Worker/Pages versions). Restore from a prior git commit only if needed.
