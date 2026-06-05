# Torgima → Cloudflare Migration

Infrastructure-only migration: **Cloudflare Pages** (frontend) + **Cloudflare Workers** (API) + **Supabase** (database). Business logic, engines, and schema are unchanged.

## Phase 1 — Cloudflare dashboard (manual)

Create these **before** first deploy:

| Resource | Name | Notes |
|----------|------|--------|
| **Pages project** | `torgima-frontend` | Connect GitHub repo `artifacts/torgima` build → `dist` |
| **Worker** | `torgima-api` | Deployed from `artifacts/api-server` |
| **KV namespace** | `TORGIMA_SESSIONS` | Copy ID into `artifacts/api-server/wrangler.jsonc` |
| **Queue** | `torgima-task-queue` | Replaces pg-boss job delivery on Workers |
| **Hyperdrive** | `torgima-supabase` | Point at Supabase Postgres connection string |

### DNS (Phase 10)

| Host | Target |
|------|--------|
| `torgima.com` | Cloudflare Pages |
| `api.torgima.com` | Worker `torgima-api` |

Set `APP_URL=https://torgima.com` on the Worker.

## Phase 2 — Frontend (Pages)

See **`artifacts/torgima/CLOUDFLARE_PAGES.md`** for exact dashboard fields.

| Field | Value |
|-------|--------|
| Build command | `pnpm build:cloudflare:pages` |
| Build output directory | `artifacts/torgima/dist` |
| **Deploy command** | **(empty)** — do not use `npx wrangler deploy` |

- Config: `artifacts/torgima/wrangler.jsonc`
- Manual CLI deploy: `pnpm deploy:cloudflare:pages`
- Set `VITE_API_BASE_URL=https://api.torgima.com` in Pages env (see `.env.production.example`)

## Phase 3–4 — API (Workers + Express bridge)

- Entry: `artifacts/api-server/src/worker.ts` — wraps existing Express `app.ts` via `cloudflare:node:http`
- No per-route Hono rewrite required for v1; `src/lib/honoCompat.ts` is available for incremental migration
- Local dev: `pnpm -F @workspace/api-server dev:worker`

## Phase 5 — Sessions (KV)

When `SESSIONS` KV binding is present:

- Magic-link verify still uses `AuthService` logic
- Session token is dual-written to KV + `sessions` table
- `validateSession` reads KV first on Workers

Cookie: `SameSite=Lax` on Cloudflare runtime.

## Phase 6 — Database (Supabase + Hyperdrive)

- Use **Hyperdrive** binding `HYPERDRIVE` in `wrangler.jsonc`
- `bindCloudflareEnv()` sets `process.env.DATABASE_URL` from Hyperdrive
- Existing `@workspace/db` Drizzle queries unchanged

## Phase 7 — Queues (pg-boss replacement)

- Producer: `lib/cloudflare-queue.ts` — `getBoss().send()` → `TASK_QUEUE.send()`
- Consumer: `src/queues/handler.ts` — dispatches to existing worker handlers
- Node/Railway: pg-boss unchanged when `TORGIMA_RUNTIME` is not `cloudflare`

Cron triggers in `wrangler.jsonc` cover scheduled jobs that previously used pg-boss cron.

## Phase 8 — CI/CD

- `.github/workflows/deploy-cloudflare.yml` — build, migrate, deploy Worker + Pages
- Keep `.github/workflows/ci.yml` for PR validation

### GitHub secrets

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Deploy Workers + Pages |
| `DATABASE_URL` | `pnpm db:migrate` in CI |

### GitHub variables

| Variable | Example |
|----------|---------|
| `VITE_API_BASE_URL` | `https://api.torgima.com` |

## Phase 9 — Worker secrets

```bash
cd artifacts/api-server
wrangler secret put DATABASE_URL      # fallback if Hyperdrive not used
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put INTERNAL_API_SECRET
wrangler secret put NEXTAUTH_SECRET
wrangler secret put APP_URL
```

## Rollback

Railway + Vercel configs remain in git history. To rollback:

1. Re-point DNS to Vercel/Railway
2. Restore `artifacts/torgima/src/config/api.ts` production URL
3. Deploy via previous pipelines
