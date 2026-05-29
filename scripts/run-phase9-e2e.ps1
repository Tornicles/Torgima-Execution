# Run Phase 9 E2E — starts local Postgres (Docker or embedded) then runs CI-equivalent tests.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
node scripts/run-phase9-e2e.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
