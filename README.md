# Torgima Execution

pnpm monorepo: **SPA** (`artifacts/torgima`) + **Express API + workers** (`artifacts/api-server`).

## Deployments (don’t duplicate Vercel)

| What | Where | Vercel project |
|------|--------|----------------|
| Frontend SPA | [**Vercel**](https://vercel.com) | **Exactly one** project (e.g. `torgima-execution`), repo root |
| REST API + pg-boss + dispatcher | **Railway** / Fly / Render / VM | **Do not** add a second Vercel app for the API — it will fail and clutter GitHub with red checks. |

Detailed steps, env vars, and pitfalls: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Local quick start

Requires Node ≥ 22 and pnpm ≥ 11 (see root `package.json` `engines`).

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

- API: configure `DATABASE_URL` then `pnpm --filter @workspace/api-server dev` (see `artifacts/api-server/.env.example`).
- SPA: `pnpm --filter @workspace/torgima dev`.

## CI

GitHub Actions **CI** workflow (`.github/workflows/ci.yml`) runs `pnpm run typecheck` and `pnpm run build` on pushes and PRs to `main`.
