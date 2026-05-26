# Bhudhi AGI Expansion Engine (Prompt 30)

**BAEE** — Bounded, governed self-improvement. Bhudhi can **propose** new capabilities; **humans** approve, promote, or rollback. This is controlled improvement, not autonomous AGI.

## Non-negotiable rules

1. Every capability requires explicit approval (default: reject).
2. No self-modification — `SELF_MODIFICATION` and `HIDE_EXPANSION` are forbidden.
3. All changes are reversible via rollback.
4. Max 1000 active capabilities; max 3 parallel testing expansions.
5. Auto-approve is **disabled** (`canAutoApprove` always returns false).
6. Complete audit trail in `bhudhi_expansion_history`.

## Architecture

```
artifacts/api-server/src/bhudhi/expansion/
├── expansion-engine/ExpansionEngine.ts
├── capability-discovery/CapabilityDiscovery.ts
├── evaluation/ExpansionEvaluation.ts
├── governance/ExpansionGovernance.ts
├── rollback/ExpansionRollback.ts
├── benchmarking/BenchmarkEngine.ts
└── expansionData.ts
```

## Database

Migration: `migrations/0025_bhudhi_agi_expansion_engine.sql`

| Table | Purpose |
|-------|---------|
| `bhudhi_expansion_capabilities` | Proposals and active capabilities |
| `bhudhi_expansion_benchmarks` | Before/after benchmarks |
| `bhudhi_expansion_history` | Audit trail |
| `bhudhi_expansion_events` | Cycle events |
| `bhudhi_expansion_memory` | Blueprint-scoped memory |

## Expansion flow

```
Observe execution patterns
  → CapabilityDiscovery.detect()
  → ExpansionEvaluation.measure()
  → ExpansionGovernance.requireApproval()
  → Human: POST /api/bhudhi/expansion/approve
  → Optional: POST /api/bhudhi/expansion/promote (governanceApproved: true)
  → Rollback: POST /api/bhudhi/expansion/rollback
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bhudhi/expansion/status?blueprintId=` | Governance status + rules |
| POST | `/api/bhudhi/expansion/discover` | Discover candidates |
| POST | `/api/bhudhi/expansion/evaluate` | Evaluate candidates |
| POST | `/api/bhudhi/expansion/benchmark` | Benchmark vs prior |
| POST | `/api/bhudhi/expansion/approve` | Human approve/reject |
| POST | `/api/bhudhi/expansion/promote` | Promote (requires `governanceApproved`) |
| POST | `/api/bhudhi/expansion/rollback` | Rollback capability |
| POST | `/api/bhudhi/expansion/reject` | Reject capability |
| POST | `/api/bhudhi/expansion/history` | History + capabilities |

### Approve and promote

```http
POST /api/bhudhi/expansion/approve
{
  "blueprintId": "<uuid>",
  "capabilityId": "<uuid>",
  "approved": true,
  "promote": true
}
```

`promote: true` sets `governanceApproved` and runs promotion in one step.

## Dashboard

`/app/bhudhi/expansion?blueprintId=<uuid>` — universal Bhudhi nav **Expansion**

## Verification

```bash
cd artifacts/api-server
pnpm exec vitest run src/tests/unit/bhudhi/bhudhi-expansion-engine.test.ts
```

## Depends on

- Prompts 1–40 (Bhudhi core + launch)
- Prompt 29 (Civilization Intelligence Engine) — recommended before scale expansion
