# Bhudhi Launch Deployment Checklist

Use this checklist before and after cutting over Bhudhi 2.0 to production. See also [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the Cloudflare Pages + Worker architecture.

## Pre-launch (1 week before)

- [ ] Run full test suite (`pnpm test` in `artifacts/api-server`)
- [ ] Run benchmark tests (`pnpm test:benchmarks` or `RUN_BHUDHI_BENCHMARKS=true`)
- [ ] Verify all API endpoints (`GET /api/bhudhi/consolidation/status`)
- [ ] Check database performance (`scripts/db-setup.sql` indexes applied)
- [ ] Review security audit (rate limiting, auth on sensitive routes)
- [ ] Confirm backup strategy (`scripts/backup-production.sh`)
- [ ] Load testing (target: 1000 concurrent users on API host)
- [ ] Performance profiling (`GET /api/bhudhi/monitoring/metrics`)

## Environment setup

- [ ] Development environment ready (`ENVIRONMENT=development`)
- [ ] Staging environment ready (`ENVIRONMENT=staging`)
- [ ] Production environment ready (`ENVIRONMENT=production`)
- [ ] All env variables set (see `artifacts/api-server/.env.production.example`)
- [ ] Database backups configured
- [ ] Monitoring dashboards ready (`/app/bhudhi/monitoring`)
- [ ] Alert thresholds set

## Code and dependencies

- [ ] All tests passing
- [ ] No critical vulnerabilities (`pnpm audit`)
- [ ] Dependencies up to date
- [ ] Build succeeds without warnings
- [ ] Production build verified (API + Vite SPA)
- [ ] Code review completed
- [ ] Documentation updated (`docs/BHUDHI_LAUNCH.md`, `docs/BHUDHI_API_REFERENCE.md`)

## Infrastructure

- [ ] Database scaled appropriately
- [ ] Cache configured (staging/production feature flags)
- [ ] CDN configured (Cloudflare Pages for SPA)
- [ ] API on Cloudflare Worker (`torgima`) at `https://api.torgima.com`
- [ ] Auto-scaling configured on API host
- [ ] Health checks active (`GET /api/health`, `GET /api/bhudhi/monitoring/health`)
- [ ] Monitoring active

## Operations

- [ ] On-call rotation established
- [ ] Incident response plan ready (`docs/PRODUCTION_RUNBOOK.md`)
- [ ] Escalation procedures documented
- [ ] Communication channels set up
- [ ] Status page configured
- [ ] Support team trained

## Launch day

- [ ] Final health check (`GET /api/bhudhi/certification`)
- [ ] Monitor for 1 hour after launch
- [ ] Check error logs
- [ ] Verify telemetry (`POST /api/telemetry` receiving events)
- [ ] Monitor performance metrics
- [ ] Test critical paths (onboarding → dashboard → kernel cycle)
- [ ] Be ready to rollback (DB backup restore procedure)

## Post-launch (first week)

- [ ] Monitor metrics closely
- [ ] Respond to user feedback
- [ ] Fix any critical issues
- [ ] Optimize performance
- [ ] Monitor costs
- [ ] Send usage reports
