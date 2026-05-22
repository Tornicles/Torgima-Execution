# Torgima Deployment

The repo is a pnpm monorepo with two deployable artifacts that **MUST be hosted on different platforms**. The Prompt 15 production handoff checklist lives in [`docs/PRODUCTION_RUNBOOK.md`](./PRODUCTION_RUNBOOK.md).

| Artifact | What it is | Where it deploys |
| --- | --- | --- |
| `artifacts/torgima` | Vite + React 19 SPA | **Vercel** (static hosting) |
| `artifacts/api-server` | Express 5 API + pg-boss workers + event dispatcher loop | **Long-running platform** (Railway / Fly.io / Render / VM) — **NOT Vercel** |

## One Vercel project only (frontend)

Link **exactly one** Vercel project to this GitHub repo, at the **repository root**, for the SPA.

- **Do not** create a second Vercel project such as `torgima-execution-api-server`. The Express app is not a valid Vercel serverless deployment for this codebase; builds fail or production never activates, and **GitHub commit checks** stay red (`Vercel - … api-server`).
- Production API traffic belongs on **Railway** (or another long-running Node host). The SPA must use **`VITE_API_BASE_URL`** pointing at that API URL.

## Why the API can't run on Vercel

Vercel's serverless functions can't run any of the following, all of which are core to the API:

- `app.listen(port)` (long-lived HTTP server)
- `boss.work(queueName, handler)` registrations on pg-boss (worker loops keep DB connections open and process jobs continuously)
- `setInterval(dispatchPendingEvents, 1000)` event dispatcher in `artifacts/api-server/src/workers/start.ts`
- `setInterval(runIntegrityChecks, 30 * 60_000)` scheduled health checks (`HealthWorker.startScheduledHealthChecks`)

Each of these requires a persistent Node process, which Vercel doesn't provide. Trying to "split" the API across Vercel functions would require ripping out pg-boss entirely (replace with Inngest / Trigger.dev / Vercel Queues) — that's a separate, much larger refactor.

The pragmatic split is: **frontend on Vercel, API + in-process workers on a Node host** (see Railway below).

---

## Frontend → Vercel

### One-time project setup

1. Create **one** Vercel project from the GitHub repo `Tornicles/Torgima-Execution` (frontend only — see [One Vercel project only](#one-vercel-project-only-frontend)).
2. **Root Directory:** leave as the repo root (`/`). The `vercel.json` at the repo root drives build configuration; it must be at the root for the pnpm workspace to resolve `@workspace/*` packages.
3. **Framework Preset:** "Other".
4. Vercel auto-detects pnpm via the lockfile. `vercel.json` already specifies the install/build commands.

### Required environment variables (Vercel dashboard → Settings → Environment Variables)

| Variable | Required for | Example |
| --- | --- | --- |
| `VITE_API_BASE_URL` | All envs (Production, Preview, Development) | `https://api.torgima.com` |

That is the only variable the SPA needs. **No trailing slash.** It must point to wherever the Express API is hosted (Railway URL, Fly URL, custom domain, etc.).

`PORT` and `BASE_PATH` are **NOT** required on Vercel — they are only used by `vite dev` / `vite preview` for local development. The Vite config (`artifacts/torgima/vite.config.ts`) defaults them when running under `vite build`.

### What root `vercel.json` does (must stay at repo root)

- **`installCommand`**: `pnpm install --no-frozen-lockfile` — workspace-wide install so `@workspace/*` packages resolve.
- **`buildCommand`**: `pnpm --filter @workspace/api-client-react build && pnpm --filter @workspace/torgima build` — shared client typings/build, then the SPA.
- **`outputDirectory`**: `artifacts/torgima/dist` — matches Vite `outDir` (`dist` under `artifacts/torgima`).
- **`routes`**: filesystem first, then `/(.*)` → `/index.html` for client-side routing (wouter) on refresh and deep links.

If anything here drifts from the actual `vercel.json` in git, trust the checked-in JSON.

### Local copy of build env

For local Vercel-style builds, copy `artifacts/torgima/.env.example` to `artifacts/torgima/.env.local` and set `VITE_API_BASE_URL`.

---

## API + workers → Long-running host

The packaged service (`pnpm --filter @workspace/api-server build` → `pnpm --filter @workspace/api-server start`) runs **one Node process**:

- **`start`** executes `node --enable-source-maps ./dist/index.mjs`.
- **`index`** binds Express on **`PORT`** and then calls **`startWorkers()`**, which registers **pg-boss** workers and the **`setInterval` event dispatcher**.

So web + worker logic share **one deployment** — which matches `artifacts/api-server/railway.json` (`pnpm --filter @workspace/api-server start`).

(Optional advanced setup: split web and `./dist/workers/start.mjs` into two Railway services with the same `DATABASE_URL`; not required by default.)

### Required environment variables

See `artifacts/api-server/.env.example` for the full list with comments. Critical ones:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres URL. Provider must support `LISTEN`/`NOTIFY` and `pg_advisory_lock` (Supabase / Neon / Railway Postgres / RDS all qualify). |
| `PORT` | Yes on Railway etc. | e.g. `3001`; required at boot — see `artifacts/api-server/src/index.ts`. |
| `FRONTEND_URL` | Required for production browsers | Exact SPA origin (e.g. `https://torgima-execution.vercel.app`) for credentialed CORS. Comma-separated for multiple preview deployments. |
| `ANTHROPIC_API_KEY` | Yes for Bhudhi | Preferred. Legacy alias: `AI_INTEGRATIONS_ANTHROPIC_API_KEY`. Without either, Bhudhi features degrade. |
| `RESEND_API_KEY` | Yes in production | Email for magic links. Without it, `sendMagicLink` can still persist the session but `{ sent: false }`. Dev logs magic link URLs when not production. |
| `RESEND_WEBHOOK_SECRET` | Recommended in production | Signing secret from the Resend dashboard for **webhooks**. Used by `POST /api/webhooks/notifications/bounce` (Svix verification). If unset, the public webhook still accepts JSON in development but will not verify signatures. Register the public URL in Resend after deploy. |
| `EMAIL_FROM` | Recommended | Defaults to `noreply@torgima.com`. |
| `EMAIL_REPLY_TO` | Optional | Defaults to `support@torgima.com`. |
| `NODE_ENV` | Yes in production | Set to `production` to enable production logging and disable dev-only fallbacks. |
| `APP_VERSION` | Recommended | Use `phase1` for Prompt 15 production health responses. |
| `PGBOSS_DATABASE_URL` | Optional | Dedicated pg-boss connection URL. Falls back to `DATABASE_URL` when unset. |
| `LOG_LEVEL` | Optional | Defaults to `info`. |

### CORS

Set **`FRONTEND_URL`** on the API to the exact SPA origin (e.g. `https://your-app.vercel.app`). The API uses **`credentials: true`** and the browser client uses **`credentials: "include"`**. If `FRONTEND_URL` is unset, local development keeps a permissive reflected origin; production should always set it (comma-separated origins are supported for preview deployments).

Preview URLs like **`https://…-git-main-….vercel.app`** are allowed automatically (any **`*.vercel.app`** origin is permitted by the API).

### Troubleshooting login / SERVICE_UNAVAILABLE

If the SPA shows a **database** or **`SERVICE_UNAVAILABLE`** message when sending a magic link, the browser reached Railway but Postgres failed (`send-magic-link` writes sessions):

1. Fix **`DATABASE_URL`** on Railway (credentials, hostname, SSL, or wrong URI variant). Many hosts require **`?sslmode=require`** on the JDBC/Postgres URL.
2. Redeploy the API after changing variables.

Email never arrives (or the UI now shows a delivery error) means one of:

1. **`RESEND_API_KEY`** is unset on the API host — the API returns `{ sent: false }`; the login page surfaces this instead of a false success.
2. **`EMAIL_FROM`** is not a domain verified in [Resend](https://resend.com) — sends fail with `sent: false` (check Railway logs for `[resend] Send failed`).
3. **`FRONTEND_URL`** does not match where users open the app — magic links point at `FRONTEND_URL/verify`; if that host is only the marketing site (no SPA), the link 404s. Set `FRONTEND_URL` to your Vercel execution app (e.g. `https://torgima-execution.vercel.app`), comma-separated before other origins if you use multiple.

### Database schema + seed

**Note:** The Drizzle schema is the database authority. Schema changes must be generated into committed Drizzle migrations and applied with `migrate`; do not use `drizzle-kit push` or ad hoc SQL patch scripts in production.

Before first boot (and after every schema change):

```bash
pnpm -F @workspace/db check
pnpm -F @workspace/db migrate
pnpm db:apply-manual                   # required: most tables/columns live in scripts/migrations/manual-*.sql
pnpm -F @workspace/db tsx src/seed.ts
pnpm -F @workspace/db verify           # table count + indexes + flags — see lib/db/src/verify-db.ts for expected baselines
```

On **Railway**, set **`DIRECT_URL`** (non-pooled Postgres URL) alongside **`DATABASE_URL`**, then use the repo `railway.json` start command (migrate → apply manual SQL → start API). If the service crashes with `parserOpenTable` / `relation does not exist`, the database never received the manual migrations — run `pnpm db:apply-manual` against production `DIRECT_URL` once, then redeploy.

Run from any machine with `DATABASE_URL`. Seed is idempotent.

### OpenAPI client regeneration

When `lib/api-spec/openapi.yaml` changes, rebuild the React + Zod clients:

```bash
pnpm -F @workspace/api-spec codegen
```

---

## Deployment flow summary

```
GitHub: Tornicles/Torgima-Execution (main)
    │
    ├──► Vercel (one project — SPA only — auto-deploy on push)
    │       Builds: @workspace/api-client-react → @workspace/torgima (see root vercel.json)
    │       Reads:  VITE_API_BASE_URL (= public Railway API URL, no trailing slash)
    │
    └──► Railway / Fly.io / Render (manual or auto-deploy on push)
            Build + start (see railway.json):  pnpm --filter @workspace/api-server start
            → node ./dist/index.mjs (Express + workers in one process)

            Reads:  DATABASE_URL, PORT, FRONTEND_URL,
                    ANTHROPIC_API_KEY (or legacy AI_INTEGRATIONS_ANTHROPIC_API_KEY),
                    RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO,
                    NODE_ENV, LOG_LEVEL, BHUDHI_*
```

The API host and the Vercel deployment must point at the **same** Postgres database. The frontend's `VITE_API_BASE_URL` must point at the API host's public URL.

## Production health check

After API deployment, external monitoring should ping:

```bash
curl -fsS https://api.torgima.com/api/health
```

The endpoint returns direct JSON with `status`, `checks.database`, `checks.bhudhi`, `checks.workers`, `checks.signals`, `version`, and operational metrics. Alert on consecutive `503` responses.
