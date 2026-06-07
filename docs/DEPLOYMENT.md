# Torgima production deployment

**Current production architecture (2026):**

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Cloudflare Pages | https://torgima.com |
| API | Cloudflare Worker | https://api.torgima.com |
| Database | Supabase Postgres | `DATABASE_URL` |
| Email | Resend | `RESEND_API_KEY` |
| AI | Anthropic | `ANTHROPIC_API_KEY` |

**Deprecated (not used in production):** Railway, Vercel.

See also: [CLOUDFLARE_MIGRATION.md](./CLOUDFLARE_MIGRATION.md), [PRODUCTION_RUNBOOK.md](./PRODUCTION_RUNBOOK.md), [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md).

---

## Frontend — Cloudflare Pages

| Setting | Value |
|---------|--------|
| Project | `torgima-execution` |
| Build command | `pnpm build:cloudflare:pages` |
| Output directory | `artifacts/torgima/dist` |
| Custom domains | `torgima.com`, `www.torgima.com` |

**Pages environment:**

| Variable | Value |
|----------|--------|
| `VITE_API_BASE_URL` | `https://api.torgima.com` |
| `NODE_VERSION` | `22` |

SPA routing: `artifacts/torgima/public/_redirects` → `/* /index.html 200`

CLI deploy: `pnpm run cf:pages:deploy`

---

## API — Cloudflare Worker

| Setting | Value |
|---------|--------|
| Worker name | `torgima` |
| Route | `api.torgima.com/*` |
| Entry | `artifacts/api-server/src/worker.ts` |
| Health | `GET https://api.torgima.com/health` |

**Worker vars** (in `wrangler.jsonc`):

- `NODE_ENV=production`
- `TORGIMA_RUNTIME=cloudflare`
- `APP_URL=https://torgima.com`
- `FRONTEND_URL=https://torgima.com`

**Worker secrets** (Wrangler dashboard or CI):

```
DATABASE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
BHUDHI_MODEL
RESEND_API_KEY
EMAIL_FROM
INTERNAL_AUTH_SECRET
NOTIFICATION_UNSUBSCRIBE_SECRET
```

**KV binding:** `SESSIONS` → namespace `TORGIMA_SESSIONS`

CLI deploy: `pnpm run deploy:cloudflare:api`

---

## Frontend API config

Canonical sources:

- `artifacts/torgima/src/config/api.ts`
- `lib/api-client-react/src/resolve-api-base.ts`

Production default: `https://api.torgima.com` (override with `VITE_API_BASE_URL`).

Development default: `http://localhost:8787` (wrangler dev) or set `VITE_API_BASE_URL`.

---

## CORS & auth

Production allowed origins:

- `https://torgima.com`
- `https://www.torgima.com`
- `https://torgima-execution.pages.dev` (preview cutover)

Magic link callback: `https://torgima.com/auth/callback`

Configured in `artifacts/api-server/src/lib/cors.ts` and `APP_URL` / `FRONTEND_URL` on the Worker.

---

## DNS (Cloudflare)

| Host | Target |
|------|--------|
| `torgima.com` | Cloudflare Pages custom domain |
| `www.torgima.com` | Cloudflare Pages custom domain |
| `api.torgima.com` | Worker route `api.torgima.com/*` |

Do not point production DNS to Railway or Vercel.

---

## GitHub Actions

**`.github/workflows/deploy-cloudflare.yml`**

1. Typecheck, build, test
2. `pnpm db:migrate` + `pnpm db:apply-manual` (uses `DATABASE_URL` secret)
3. Deploy Worker
4. Deploy Pages (`torgima-execution`)
5. Verify `https://api.torgima.com/health` and `https://torgima.com`

**Required secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL`, Supabase keys, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `INTERNAL_AUTH_SECRET`, `NOTIFICATION_UNSUBSCRIBE_SECRET`

**Variable:** `VITE_API_BASE_URL=https://api.torgima.com`

---

## Verification

```bash
curl -fsS https://api.torgima.com/health
curl -fsS https://api.torgima.com/api/auth/session
curl -I https://torgima.com
curl -fsS https://api.torgima.com/api/debug/cloudflare-env
curl -fsS https://api.torgima.com/api/debug/blueprint-launch-health
```

---

## Local development

```bash
pnpm install
pnpm exec wrangler dev          # API on :8787
pnpm -F @workspace/torgima dev  # SPA on :5173
```

Set `VITE_API_BASE_URL=http://localhost:8787` in `artifacts/torgima/.env.local`.

---

## Legacy platforms

Railway (`artifacts/api-server/railway.json`) and Vercel configs remain in git history for reference only. **Do not deploy production to them.**
