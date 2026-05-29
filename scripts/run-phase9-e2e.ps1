# Run Phase 9 E2E (requires Postgres on localhost:5432, same as CI).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/torgima_test"
  $env:DIRECT_URL = $env:DATABASE_URL
}

$env:TORGIMA_INTEGRATION = "true"

Write-Host "Applying schema (pnpm db:ci)..."
pnpm db:ci
if ($LASTEXITCODE -ne 0) {
  Write-Error "db:ci failed. Start Postgres (CI uses postgres:15 on port 5432) or set DATABASE_URL."
}

Write-Host "Verifying schema..."
pnpm exec tsx scripts/ci-verify-schema.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Running Phase 9 scenarios..."
pnpm -F @workspace/api-server exec vitest run src/tests/e2e/phase9/scenarios.test.ts --testTimeout=120000 --hookTimeout=120000
