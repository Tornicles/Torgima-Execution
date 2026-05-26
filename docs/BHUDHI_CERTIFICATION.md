# BHUDHI Certification & Benchmarks (Prompt 38)

Bhudhi Readiness Score (BRS) and benchmark suite for launch validation.

## BRS tiers

| Score | Category | Meaning |
|-------|----------|---------|
| 0–39 | `not-ready` | Critical gaps |
| 40–69 | `partial` | Improvements needed |
| 70–84 | `production` | Ready for production |
| 85–100 | `enterprise` | Enterprise-ready |

## API

```http
GET /api/bhudhi/certification
```

Returns weighted scores across:

- Reliability (kernel uptime, runtime success, monitoring health)
- Performance (protocol latency, memory size)
- Security (rejections, auth secrets, AI keys in prod)
- Operational (health endpoints, logging, backup/migrate scripts)
- Scalability (indexes, rate limits, optional Redis)
- Consolidation (migrations 0026–0029, catalog seed)

## Dashboard

`/app/bhudhi/certification` — scorecard, criteria breakdown, export JSON, re-run.

## Benchmarks (Vitest)

Located in `artifacts/api-server/src/tests/benchmarks/`:

| File | Focus |
|------|--------|
| `reliability.bench.test.ts` | Kernel cycle success, latency p99, concurrency |
| `memory.bench.test.ts` | Node ingest throughput, query p99 |
| `protocol.bench.test.ts` | Message send throughput |
| `execution.bench.test.ts` | Task execution success, concurrency |

### CI vs full suite

By default benchmarks use reduced iteration counts for fast CI.

```bash
cd artifacts/api-server
pnpm exec vitest run src/tests/benchmarks

# Full-scale (prompt targets: 1000 cycles, 10k nodes, etc.)
RUN_BHUDHI_BENCHMARKS=true pnpm exec vitest run src/tests/benchmarks
```

## Related

- [BHUDHI_PRODUCTION_INFRASTRUCTURE.md](./BHUDHI_PRODUCTION_INFRASTRUCTURE.md)
- [BHUDHI_OS_SPEC.md](./BHUDHI_OS_SPEC.md)
