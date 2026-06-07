# Bhudhi Launch Architecture (Prompt 40)

Production launch configuration: environments, pricing tiers, onboarding, telemetry, and deployment artifacts.

## Environment configuration

Server module: `artifacts/api-server/src/config/environments.ts`

| Environment | Resolved when | Monitoring | Rate limit | Telemetry sample |
|-------------|---------------|------------|------------|------------------|
| `development` | default / `ENVIRONMENT=development` | off | off | 0% |
| `staging` | `ENVIRONMENT=staging` or Pages preview URL | on | on | 50% |
| `production` | `NODE_ENV=production` | on | on | 10% |

Override API URL with `API_PUBLIC_URL`, `PUBLIC_API_URL`, or `VITE_API_BASE_URL`.

```http
GET /api/bhudhi/launch/config
```

## Pricing tiers

Module: `artifacts/api-server/src/pricing/bhudhiTiers.ts`

| Bhudhi tier | Torgima `user_tier` | Blueprints (default) |
|-------------|---------------------|------------------------|
| `free` | `starter` | 1 |
| `pro` | `growth` | 10 |
| `enterprise` | `ultimate` | 100 |

Environment caps may further limit blueprints (`limits.blueprintsPerUser`).

```http
GET /api/bhudhi/launch/limits
```

Requires session auth.

## Onboarding

| Surface | Path |
|---------|------|
| 4-step UI | `/app/bhudhi/onboarding` |
| API | `POST /api/bhudhi/launch/onboard` |

Stores `metadata.bhudhiLaunch` on the user row and updates `tier` to the mapped Torgima tier.

Main Torgima goal onboarding remains at `/onboarding` — do not conflate the two flows.

## Telemetry

| Component | Path |
|-----------|------|
| Server buffer | `artifacts/api-server/src/telemetry/Telemetry.ts` |
| Ingestion | `POST /api/telemetry` |
| Client helper | `artifacts/torgima/src/lib/bhudhi-telemetry.ts` |

Events are logged server-side (structured `console.info`). Wire to an external analytics provider in production as needed.

## Launch status

```http
GET /api/bhudhi/launch/status
```

Returns manifest: routes, dashboard paths, doc links, feature flags.

## Dashboard

- `/app/bhudhi/launch` — environment, tiers, checklist links
- `/app/bhudhi/onboarding` — first-time Bhudhi setup

## Deployment artifacts

- [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md)
- [`RELEASE_NOTES.md`](./RELEASE_NOTES.md)
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Cloudflare Pages + Worker (Vercel deprecated)

## Verification

```bash
cd artifacts/api-server
pnpm exec vitest run src/tests/unit/bhudhi/bhudhi-launch.test.ts
pnpm exec vitest run src/tests/unit/bhudhi/bhudhi-consolidation.test.ts
```

## Related prompts

| Prompt | Topic |
|--------|--------|
| 37 | Production infrastructure |
| 38 | Certification (BRS) |
| 39 | Torgima convergence |
| 40 | Launch (this document) |
