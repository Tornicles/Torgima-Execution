# Cloudflare Pages — dashboard settings

Use these values in **Workers & Pages → torgima-execution → Settings → Builds**.

## Required settings

| Field | Value |
|-------|--------|
| **Framework preset** | None |
| **Root directory** | `/` (repo root) |
| **Build command** | `pnpm build:cloudflare:pages` |
| **Build output directory** | `artifacts/torgima/dist` |
| **Deploy command** | **Leave empty** |

## Why deploy command must be empty

Pages publishes the build output automatically. A custom deploy command such as `npx wrangler deploy` is for **Workers**, not static Pages. It fails with `wrangler: not found` in this monorepo and is not needed.

If your dashboard forces a deploy command, use:

```bash
pnpm deploy:cloudflare:pages
```

Do **not** use `npx wrangler deploy`.

## Environment variables

| Variable | Example |
|----------|---------|
| `VITE_API_BASE_URL` | `https://api.torgima.com` |
| `NODE_VERSION` | `22` (or match `.nvmrc`) |

## SPA routing

`public/_redirects` ships `/* → /index.html` for client-side routes (`/login`, `/auth/callback`, etc.).
