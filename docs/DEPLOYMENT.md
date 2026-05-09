# Torgima Deployment

The repo is a pnpm monorepo with two deployable artifacts that **MUST be hosted on different platforms**:

| Artifact | What it is | Where it deploys |
| --- | --- | --- |
| `artifacts/torgima` | Vite + React 19 SPA | **Vercel** (static hosting) |
| `artifacts/api-server` | Express 5 API + pg-boss workers + event dispatcher loop | **Long-running platform** (Railway / Fly.io / Render / VM) — **NOT Vercel** |

## Why the API can't run on Vercel

Vercel's serverless functions can't run any of the following, all of which are core to the API:

- `app.listen(port)` (long-lived HTTP server)
- `boss.work(queueName, handler)` registrations on pg-boss (worker loops keep DB connections open and process jobs continuously)
- `setInterval(dispatchPendingEvents, 1000)` event dispatcher in `artifacts/api-server/src/workers/start.ts`
- `setInterval(runIntegrityChecks, 30 * 60_000)` scheduled health checks (`HealthWorker.startScheduledHealthChecks`)

Each of these requires a persistent Node process, which Vercel doesn't provide. Trying to "split" the API across Vercel functions would require ripping out pg-boss entirely (replace with Inngest / Trigger.dev / Vercel Queues) — that's a separate, much larger refactor.

The pragmatic split is: **frontend on Vercel, API + workers on a Node host that supports `node dist/server.js` and `node dist/workers/start.js` as long-running processes.**

---

## Frontend → Vercel

### One-time project setup

1. Create a new Vercel project from the GitHub repo `Tornicles/Torgima-Execution`.
2. **Root Directory:** leave as the repo root (`/`). The `vercel.json` at the repo root drives build configuration; it must be at the root for the pnpm workspace to resolve `@workspace/*` packages.
3. **Framework Preset:** "Other".
4. Vercel auto-detects pnpm via the lockfile. `vercel.json` already specifies the install/build commands.

### Required environment variables (Vercel dashboard → Settings → Environment Variables)

| Variable | Required for | Example |
| --- | --- | --- |
| `VITE_API_BASE_URL` | All envs (Production, Preview, Development) | `https://api.torgima.com` |

That is the only variable the SPA needs. **No trailing slash.** It must point to wherever the Express API is hosted (Railway URL, Fly URL, custom domain, etc.).

`PORT` and `BASE_PATH` are **NOT** required on Vercel — they are only used by `vite dev` / `vite preview` for local development. The Vite config (`artifacts/torgima/vite.config.ts`) defaults them when running under `vite build`.

### What `vercel.json` does

- `installCommand`: `pnpm install --no-frozen-lockfile` — uses pnpm at the workspace root, tolerant of catalog drift between local and Vercel's pnpm version.
- `buildCommand`: `pnpm -F @workspace/torgima build` — builds only the SPA, not the API or other workspace packages.
- `outputDirectory`: `artifacts/torgima/dist/public` — matches Vite's configured `outDir`.
- `rewrites`: serves `/index.html` for any non-asset route so wouter's client-side routing works on hard refresh / direct links.
- `headers`: 1-year immutable cache for hashed static assets in `/assets/*`.

### Local copy of build env

For local Vercel-style builds, copy `artifacts/torgima/.env.example` to `artifacts/torgima/.env.local` and set `VITE_API_BASE_URL`.

---

## API + workers → Long-running host

The API service is a **single deployable unit** that runs two processes:

1. **Web** — `node dist/server.js` (Express on `$PORT`)
2. **Worker** — `node dist/workers/start.js` (registers all pg-boss workers, starts the event dispatcher loop, and the scheduled health-check interval)

You can run both on the same host as separate processes (Railway/Render Procfile-style), or split them across two services that share the same `DATABASE_URL`.

### Required environment variables

See `artifacts/api-server/.env.example` for the full list with comments. Critical ones:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres URL. Provider must support `LISTEN`/`NOTIFY` and `pg_advisory_lock` (Supabase / Neon / Railway Postgres / RDS all qualify). |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Yes for Bhudhi | Without it, `BhudhiService` will fail; deterministic fallbacks still work. |
| `RESEND_API_KEY` | Yes in production | Without it, `sendMagicLink` returns `{ sent: false }` and auth doesn't work for new users. Dev mode logs the magic link to the console regardless. |
| `EMAIL_FROM` | Recommended | Defaults to `noreply@torgima.com`. |
| `EMAIL_REPLY_TO` | Optional | Defaults to `support@torgima.com`. |
| `NODE_ENV` | Yes in production | Set to `production` to enable production logging and disable dev-only fallbacks. |
| `LOG_LEVEL` | Optional | Defaults to `info`. |

### CORS

The frontend will send credentialled requests to the API origin (cookies for session). Make sure the API's CORS layer allows the Vercel origin (e.g. `https://<project>.vercel.app` and any custom domain). This is configured in the API's Express app — not in this deployment doc.

### Database migrations + seed

Before first boot of the API:

```bash
pnpm -F @workspace/db migrate         # drizzle-kit migrate
pnpm -F @workspace/db tsx src/seed.ts # feature flags + dev users (idempotent)
node lib/db/dist/verify-db.js         # sanity check: 57 tables, 6 partial indexes, 14 feature flags
```

Run migrations from any environment that has `DATABASE_URL`. Seed is idempotent and safe to re-run.

---

## Deployment flow summary

```
GitHub: Tornicles/Torgima-Execution (main)
    │
    ├──► Vercel (auto-deploy on push to main)
    │       Builds artifacts/torgima → static SPA
    │       Reads:  VITE_API_BASE_URL
    │
    └──► Railway / Fly.io / Render (manual or auto-deploy on push)
            Builds artifacts/api-server + lib/db
            Runs:   node dist/server.js  (web)
                    node dist/workers/start.js  (worker)
            Reads:  DATABASE_URL, AI_INTEGRATIONS_ANTHROPIC_API_KEY,
                    RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO,
                    NODE_ENV, LOG_LEVEL, BHUDHI_*
```

The API host and the Vercel deployment must point at the **same** Postgres database. The frontend's `VITE_API_BASE_URL` must point at the API host's public URL.
