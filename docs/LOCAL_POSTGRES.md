# Local Postgres for Phase 9 E2E

Matches CI: `postgresql://postgres:postgres@localhost:5432/torgima_test`

## Quick start

```powershell
pnpm postgres:up
pnpm test:phase9:local
```

Or one command:

```powershell
.\scripts\run-phase9-e2e.ps1
```

## Methods

1. **Docker** (preferred if Docker Desktop is installed): `docker-compose.postgres.yml`
2. **embedded-postgres** (no Docker): downloads Postgres 15 binaries on first run into `.local/postgres-data`

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm postgres:up` | Start Postgres and write `.env.local` |
| `pnpm postgres:down` | Stop local Postgres |
| `pnpm test:phase9:local` | Schema + Phase 9 scenarios |

## Environment

After `postgres:up`, these are set in `.env.local`:

- `DATABASE_URL`
- `DIRECT_URL`
- `TEST_DATABASE_URL`

Integration tests require `TORGIMA_INTEGRATION=true` (set automatically by `test:phase9:local`).
