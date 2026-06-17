# TORGIMA Production Readiness Report

*Generated: 2026-06-17T12:55:12.942Z*

## Executive summary

**Verdict:** NOT_READY

### Blockers
- INTERNAL_AUTH_SECRET_MISMATCH
- DATABASE_URL_AUTH_FAILED
- events:prod:verify failed
- bhudhi:prod:verify failed
- production smoke failed

## Pre-commit verification (local)

| Check | Result |
| --- | --- |

## Deployment

| Probe | Result | Detail |
| --- | --- | --- |
| API /health | PASS | https://api.torgima.com |
| Frontend torgima.com | — |  |

## Production probes

| Probe | Result | Class |
| --- | --- | --- |
| internal_auth | PASS | PASS |
| canonical_api_health | PASS | CANONICAL_API_HEALTH_PASS |
| worker_database_target_debug | FAIL | INTERNAL_AUTH_SECRET_MISMATCH |
| worker_bhudhi_debug | FAIL | INTERNAL_AUTH_SECRET_MISMATCH |
| workers_dev_debug_db_target | WARN | WORKERS_DEV_ROUTE_404_OPTIONAL |
| supabase_management_api_config | FAIL | SUPABASE_MANAGEMENT_API_SKIPPED |

## Production verification

| Check | Result | Notes |
| --- | --- | --- |
| supabase_management_api_config | SKIPPED |  |
| runtime_database_connection | FAIL |  |
| events_production_verification | FAIL |  |
| bhudhi_production_verification | FAIL |  |
| production_smoke | FAIL |  |
| worker_database_target_debug | 403 |  |
| worker_bhudhi_debug | 403 |  |

## Alignment artifacts

- reports/TORGIMA_FULL_SYSTEM_ALIGNMENT_REPORT.md
- reports/TORGIMA_FULL_SYSTEM_ALIGNMENT_REPORT.json
- reports/TORGIMA_FULL_SYSTEM_ALIGNMENT_REPORT.pdf
