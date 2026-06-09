# Torgima Execution

pnpm monorepo: **SPA** (`artifacts/torgima`) + **Express API on Cloudflare Workers** (`artifacts/api-server`).

## Production architecture

| Layer | Platform | URL |
|-------|----------|-----|
| Frontend | **Cloudflare Pages** (`torgima-execution`) | https://torgima.com |
| API | **Cloudflare Worker** (`torgima`) | https://api.torgima.com |
| Database / Auth | **Supabase** | via `DATABASE_URL` |
| Email | **Resend** | `RESEND_API_KEY` |
| AI | **Anthropic** | `ANTHROPIC_API_KEY` |

Production is **Cloudflare + Supabase only**. Railway and Vercel are not part of the deploy path.

Full guide: **[docs/CLOUDFLARE_MIGRATION.md](docs/CLOUDFLARE_MIGRATION.md)** · **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** · **[docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md)**

## Local quick start

Requires Node ≥ 22 and pnpm ≥ 11.

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

- **API (Workers dev):** `pnpm exec wrangler dev` or `pnpm -F @workspace/api-server dev:worker`
- **API (Node):** configure `DATABASE_URL` then `pnpm start:api`
- **SPA:** `pnpm -F @workspace/torgima dev` (set `VITE_API_BASE_URL=http://localhost:8787` for wrangler dev)

## CI / deploy

- **CI:** `.github/workflows/ci.yml` — typecheck, build, tests
- **Production deploy:** `.github/workflows/deploy-cloudflare.yml` — migrations, Worker, Pages

Required GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL`, Supabase keys, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `INTERNAL_AUTH_SECRET`, etc.

GitHub variable: `VITE_API_BASE_URL=https://api.torgima.com`
