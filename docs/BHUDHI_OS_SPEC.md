# BHUDHI Operating System Specification

## Complete System Reference Manual

**Version:** 2.0  
**Status:** Production (Phase 2 consolidated)  
**Last Updated:** May 24, 2026  
**Maintainers:** Torgima / Bhudhi team  

**Related docs:** [BHUDHI_CONSOLIDATION_PHASE.md](./BHUDHI_CONSOLIDATION_PHASE.md) · [BHUDHI_API_REFERENCE.md](./BHUDHI_API_REFERENCE.md) · [BHUDHI_ARCHITECTURE_DIAGRAMS.md](./BHUDHI_ARCHITECTURE_DIAGRAMS.md) · [BHUDHI_PRODUCTION_INFRASTRUCTURE.md](./BHUDHI_PRODUCTION_INFRASTRUCTURE.md) · [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Table of contents

1. [System overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Core concepts](#3-core-concepts)
4. [Engines and systems](#4-engines-and-systems)
5. [Memory system](#5-memory-system)
6. [Protocol layer](#6-protocol-layer-bhudi)
7. [Event bus](#7-event-bus)
8. [Execution runtime](#8-execution-runtime)
9. [Dashboard](#9-dashboard)
10. [API reference](#10-api-reference)
11. [Deployment](#11-deployment)
12. [Operations](#12-operations)
13. [Troubleshooting](#13-troubleshooting)
14. [Performance tuning](#14-performance-tuning)

---

## 1. System overview

### What is Bhudhi?

Bhudhi is a unified intelligence layer that turns execution data, signals, and blueprint context into coordinated recommendations and safe execution. It sits between Torgima (goals, orders, validation) and the user-facing product.

**Core principle:** Observe → understand → decide → execute → learn.

### Design philosophy

- **Separation of concerns:** Five core systems with clear roles
- **Event-driven coordination:** Kernel cycle and optional event-bus handlers
- **Memory-centric knowledge:** Unified memory graph (Prompt 32)
- **Protocol-based messaging:** BHUDHI:// internal URIs (Prompt 33)
- **Production-oriented:** Drizzle schema, Express API, authenticated routes

### Key metrics (target architecture)

| Area | Count |
|------|-------|
| Core systems | 5 (Investigation, Intelligence, Operating, Security, Preservation) |
| Specialized engines | 40+ (economics, world, erector, teams, …) |
| Frameworks | 14+ catalog entries |
| Domains | 7 lifecycle domains |
| Consolidation layers | Kernel, Memory Graph, Protocol, Dashboard, Runtime |

### Repository layout (implementation)

| Path | Role |
|------|------|
| `artifacts/api-server/src/bhudhi/` | Bhudhi services, kernel, memory, protocol, runtime |
| `lib/db/src/schema/bhudhiTables.ts` | Drizzle schema (not Prisma) |
| `migrations/0026`–`0029` | Phase 2 consolidation SQL |
| `artifacts/torgima/src/components/bhudhi/universal/` | Universal dashboard UI |
| `artifacts/torgima` → `/app/bhudhi` | Frontend entry |

---

## 2. Architecture

### High-level flow

```
User / Torgima
    ↓
Blueprint + orders + feedback
    ↓
BHUDHI Cognitive Kernel (runCycle)
    ├─ Investigation → Intelligence → Security → Operating → Preservation
    ↓
Event Bus (persisted kernel events + optional handlers)
    ↓
Shared Context (bhudhi_shared_context)
    ↓
Memory Graph (nodes, edges, timeline)
    ↓
BHUDHI:// Protocol (message log + router)
    ↓
Unified Execution Runtime (decision | simulation | team | organization | task)
    ↓
Dashboard /app/bhudhi
    ↓
User feedback → Torgima loop
```

### Consolidation stack (Prompts 31–35)

```
┌─────────────────────────────────────────┐
│ COGNITIVE KERNEL (31)                   │
│  Investigation → Intelligence → …       │
├─────────────────────────────────────────┤
│ EVENT BUS + SHARED CONTEXT                │
├─────────────────────────────────────────┤
│ MEMORY GRAPH (32)                       │
├─────────────────────────────────────────┤
│ BHUDHI:// PROTOCOL (33)                 │
├─────────────────────────────────────────┤
│ EXECUTION RUNTIME (35)                  │
├─────────────────────────────────────────┤
│ UNIVERSAL DASHBOARD (34) /app/bhudhi    │
└─────────────────────────────────────────┘
```

### Code entry points

| Component | Primary module |
|-----------|----------------|
| Kernel cycle | `artifacts/api-server/src/bhudhi/kernel/cognitive-kernel/CognitiveKernel.ts` |
| Event bus | `artifacts/api-server/src/bhudhi/kernel/event-bus/EventBus.ts` |
| Shared context | `artifacts/api-server/src/bhudhi/kernel/shared-context/SharedContext.ts` |
| Memory graph | `artifacts/api-server/src/bhudhi/kernel/memory/memory-graph/MemoryGraph.ts` |
| Protocol | `artifacts/api-server/src/bhudhi/protocol/BhudhiProtocol.ts` |
| Runtime | `artifacts/api-server/src/bhudhi/runtime/ExecutionRuntime.ts` |
| BhudhiCore (legacy + graph context) | `artifacts/api-server/src/bhudhi/BhudhiCore.ts` |

---

## 3. Core concepts

### Signal system

Signals summarize execution health for a blueprint.

**Common global signals:** nothingness, danger, urgency, stability, power, affluence, power_change (see `bhudhi` signal engines and `/api/bhudhi/signals`).

**Flow:** metrics + investigations → signal calculation → governance / dashboard display.

### Condition system

Conditions encode what modes of action are appropriate given the current signal (enforcement packages, governance console). Control recommends; humans retain final authority on high-stakes decisions.

### Memory graph

Single graph replacing fragmented per-domain memory tables for consolidation-era queries.

**Node types (examples):** `belief`, `decision`, `signal`, `investigation`, `learning`, `event`, …

**Edge types:** `depends_on`, `influences`, `contradicts`, `supports`, `evolves_to`, `similar_to`

**Tables:** `bhudhi_memory_nodes`, `bhudhi_memory_edges`, `bhudhi_memory_timeline`, `bhudhi_memory_relationships`, `bhudhi_memory_queries`

### Shared context

Per-blueprint JSON subsystems: `context`, `ideas`, `strategy`, `predictions`, `knowledge`, `behavior`, `execution`, `investigations`. Updated by kernel cycle and engines.

---

## 4. Engines and systems

### Investigation system

**Purpose:** Discover truth about current state (CIS, EIS, BIS modules).

**API:** `POST /api/bhudhi/investigate`

### Intelligence system

**Purpose:** Recommendations, strategy, frameworks (IIS, SIS, PIS, KIS).

**API:** `POST /api/bhudhi/recommend`, `GET /api/bhudhi/insights`

### Operating system

**Purpose:** Execute approved recommendations through a 10-engine pipeline.

**API:** `POST /api/bhudhi/execute` (legacy recommendation path)

### Security system

**Purpose:** Validate recommendations and execution against policy.

**API:** `POST /api/bhudhi/security/validate` (and gates inside Operating)

### Preservation system

**Purpose:** Consolidate learnings, improve frameworks.

**API:** Invoked inside kernel cycle; `POST /api/bhudhi/preservation/*` routes where exposed

### Specialized engines (still available)

Accessible via dedicated routes and Systems section in dashboard: economics, decision, beliefs, world, identity, organization, teams, experiments, erector, civilization, expansion, temporal, governor, reliability, security engine, infrastructure.

---

## 5. Memory system

### Memory node (logical shape)

```typescript
interface MemoryNode {
  id: string;
  blueprintId: string;
  nodeType: string;
  nodeId: string;
  content: Record<string, unknown>;
  summary: string;
  sourceEngine: string;
  confidence: number;
  importance: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Operations

| Operation | API |
|-----------|-----|
| Query | `POST /api/bhudhi/memory/query` |
| Stats | `GET /api/bhudhi/memory/stats` |
| Migrate legacy → graph | `POST /api/bhudhi/memory/migrate` |
| Timeline | `GET /api/bhudhi/memory/timeline` |
| Related nodes | `GET /api/bhudhi/memory/related` |
| Consolidate by type | `POST /api/bhudhi/memory/consolidate` |

### Adapter

`MemoryAdapter.migrateAll()` pulls signals, investigations, recommendations, framework learnings, kernel events, and shared context into the graph.

### BhudhiCore integration

`BhudhiCore` merges `memoryGraph.queryForContext()` with legacy `MemoryService` retrieval for prompts.

---

## 6. Protocol layer (BHUDHI://)

### Message format

```typescript
interface BhudhiMessage {
  version: "1.0";
  messageType: "request" | "response" | "event" | "query";
  from: string;
  to: string;
  uri: string; // bhudhi://system/action
  payload: Record<string, unknown>;
}
```

### Example URIs

```
bhudhi://investigation/complete
bhudhi://intelligence/recommend
bhudhi://security/validate
bhudhi://operating/execute
bhudhi://preservation/learn
```

### Lifecycle

1. **Send** — `POST /api/bhudhi/protocol/send` (optional `autoRoute: true`)
2. **Persist** — `bhudhi_protocol_messages`
3. **Route** — `ProtocolRouter` → handler + optional EventBus publish
4. **Acknowledge** — status `processed` | `failed`
5. **History** — `GET /api/bhudhi/protocol/history`

Kernel `runCycle` also records protocol steps via `recordProtocolStep()` for each pipeline stage.

---

## 7. Event bus

### Persisted event types (kernel cycle)

```
investigation.complete
intelligence.complete
security.approved | security.rejected
operating.complete
preservation.complete
kernel.cycle.complete
```

### Usage

- **Sequential pipeline:** `CognitiveKernel.runCycle()` — primary production path
- **Optional handlers:** `cognitiveKernel.enableEventHandlers()` for event-only workflows
- **Storage:** `bhudhi_kernel_events` with `chain_id`, `parent_event_id`

### Cleanup

`EventBus.cleanup(daysOld)` archives old events (default 7 days). Exposed through kernel data layer; schedule via ops job if needed.

---

## 8. Execution runtime

### Execution types

| Type | Executor |
|------|----------|
| `decision` | `DecisionExecutor` → `OperatingService` when `recommendationId` present |
| `simulation` | `SimulationExecutor` → erector `SimulationExecution` |
| `team` | `TeamCoordinator` → `TeamExecution` |
| `organization` | `OrganizationOrchestrator` → `ExecutionCoordinator` |
| `task` | `TaskManager` |

### Lifecycle

```
POST /api/bhudhi/runtime/execute
  → create context (pending)
  → steps + progress updates
  → complete → bhudhi_unified_execution_results
```

### Tables

- `bhudhi_unified_execution_contexts`
- `bhudhi_unified_execution_steps`
- `bhudhi_unified_execution_feedback`
- `bhudhi_unified_execution_results`

### Legacy execute path

`POST /api/bhudhi/execute` — approved **recommendation** execution only (security + operating). Do not confuse with unified runtime.

---

## 9. Dashboard

### Routes (`artifacts/torgima`)

| Section | Path |
|---------|------|
| Overview | `/app/bhudhi` |
| Execution | `/app/bhudhi/execution` |
| Intelligence | `/app/bhudhi/intelligence` |
| Governance | `/app/bhudhi/governance` |
| Memory | `/app/bhudhi/memory` |
| Protocol | `/app/bhudhi/protocol` |
| Systems | `/app/bhudhi/systems` |
| Settings | `/app/bhudhi/settings` |

Always pass `?blueprintId=<uuid>` when possible.

### Data sources per section

| Section | APIs |
|---------|------|
| Overview | `/api/bhudhi/status`, `/api/bhudhi/signals`, memory stats, protocol count |
| Execution | `/api/bhudhi/kernel/cycle`, context, runtime stats/history |
| Intelligence | investigate, recommend, insights |
| Governance | signals, governance console link |
| Memory | migrate, stats, query, timeline |
| Protocol | routes, history, send |
| Systems | status, modules, deep engine links |

---

## 10. API reference

See **[BHUDHI_API_REFERENCE.md](./BHUDHI_API_REFERENCE.md)** for the full endpoint catalog with request examples.

**Discovery endpoint:** `GET /api/bhudhi/consolidation/status` — Phase 2 manifest.

---

## 11. Deployment

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (Supabase or self-hosted)
- pnpm monorepo
- Cloudflare Worker for API (Express bridge on Workers)
- Cloudflare Pages for frontend SPA (`https://torgima.com`)

### Steps

```bash
pnpm install
pnpm db:migrate          # applies SQL in migrations/
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/torgima build
```

Deploy per [DEPLOYMENT.md](./DEPLOYMENT.md). Set `VITE_API_BASE_URL=https://api.torgima.com` on Cloudflare Pages.

### Bhudhi migrations (Phase 2)

Apply in order on production Postgres:

1. `0026_bhudhi_unified_cognitive_kernel.sql`
2. `0027_bhudhi_unified_memory_graph.sql`
3. `0028_bhudhi_protocol_layer.sql`
4. `0029_bhudhi_unified_execution_runtime.sql`

### Environment variables

See `artifacts/api-server/.env.example` — minimum: `DATABASE_URL`, auth secrets, AI keys as required by features in use.

---

## 12. Operations

### Health checks

```bash
curl https://<api>/api/bhudhi/health
curl https://<api>/api/bhudhi/consolidation/status
curl https://<api>/api/bhudhi/status?blueprintId=<uuid>
```

### Manual kernel cycle

```bash
curl -X POST https://<api>/api/bhudhi/kernel/cycle \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{"blueprintId":"<uuid>"}'
```

### Memory maintenance

```bash
curl -X POST https://<api>/api/bhudhi/memory/consolidate \
  -H "Content-Type: application/json" \
  -d '{"blueprintId":"<uuid>"}'

curl -X POST https://<api>/api/bhudhi/memory/migrate \
  -d '{"blueprintId":"<uuid>"}'
```

### Protocol inspection

```bash
curl "https://<api>/api/bhudhi/protocol/history?blueprintId=<uuid>"
```

### Runtime stats

```bash
curl "https://<api>/api/bhudhi/execution/stats?blueprintId=<uuid>"
```

### Monitoring checklist

1. Kernel cycle success rate (`status: completed`)
2. Memory graph node growth / query latency
3. Protocol message failures (`status: failed`)
4. Runtime success rate (`execution/stats`)
5. API p95 latency and 5xx rate

---

## 13. Troubleshooting

### Events not advancing

**Symptoms:** Stuck cycle, empty `eventIds`, or `security.rejected` immediately.

**Checks:**

1. Blueprint has approved recommendation if expecting operating step
2. `GET /api/bhudhi/kernel/events?blueprintId=&chainId=`
3. API logs for `[CognitiveKernel]` or `[EventBus]`
4. Re-run `POST /api/bhudhi/kernel/cycle`

### Memory graph empty after migrate

**Symptoms:** `totalNodes: 0` after migrate.

**Checks:**

1. Legacy tables have data for blueprint
2. Run `POST /api/bhudhi/memory/migrate` then `GET /api/bhudhi/memory/stats`
3. Verify migration `0027` applied

### Protocol routing failures

**Symptoms:** `autoRoute` returns error, status `failed`.

**Checks:**

1. `GET /api/bhudhi/protocol/routes` — default routes registered on first send
2. URI must match `bhudhi://<system>/<action>`
3. Handler logs in `ProtocolRouter`

### Execution runtime failures

**Symptoms:** `POST /api/bhudhi/runtime/execute` 500.

**Checks:**

1. Valid `executionType` enum
2. For `decision`, include `recommendationId` and approved status
3. `GET /api/bhudhi/runtime/context?executionId=&blueprintId=`

### Schema / import errors

**Symptoms:** API fails to start after pull.

**Checks:**

1. All migrations applied
2. `pnpm install` at repo root
3. Rebuild `@workspace/db`

---

## 14. Performance tuning

### Database

- Ensure indexes on `blueprint_id` for all `bhudhi_*` tables
- Archive old `bhudhi_kernel_events` periodically
- Run `memory/consolidate` for large blueprints
- Connection pooling on API host

### API

- Cache `GET /api/bhudhi/kernel/context` per blueprint (short TTL) if read-heavy
- Paginate `memory/query` with `limit` ≤ 100
- Rate-limit expensive cycles per user/blueprint

### Memory graph

- Set sensible `expires_at` on nodes (default 1 year in `MemoryGraph.addNode`)
- `cleanupExpired()` for archived blueprints
- Avoid unbounded `migrate` on every page load (dashboard migrates once per refresh — consider ops-only in production)

---

## Appendix A: Signal interpretation

| Signal | Meaning | Typical action |
|--------|---------|----------------|
| Nothingness | Unclear / no progress | Clarify goals, reduce scope |
| Danger | Risk elevated | Protective measures, pause expansion |
| Urgency | Time-critical | Prioritize execution |
| Stability | Steady state | Continue normal operations |
| Power | Strong momentum | Scale initiatives |
| Affluence | Resource-rich | Optimize and invest |
| Power change | Transition | Monitor, avoid thrashing |

---

## Appendix B: Error codes (application)

| Code | Meaning | Suggested fix |
|------|---------|----------------|
| E001 | Signal calculation failed | Re-run `POST /api/bhudhi/signals`, check investigations |
| E002 | Memory query timeout | Consolidate graph, reduce limit |
| E003 | Protocol routing failed | Check URI and `protocol/routes` |
| E004 | Runtime validation failed | Verify payload for execution type |
| E005 | Security violation | Review recommendation / governance |

(API may return `VALIDATION_ERROR`, `NOT_FOUND` envelope codes — see `bhudhiApiEnvelope`.)

---

## Appendix C: Quick start (local)

```bash
# 1. Install
pnpm install

# 2. Database
pnpm db:migrate

# 3. Dev (separate terminals)
pnpm --filter @workspace/api-server dev
pnpm --filter @workspace/torgima dev

# 4. Open dashboard
# http://localhost:5173/app/bhudhi?blueprintId=<your-blueprint-uuid>

# 5. Run kernel cycle (authenticated session required)
curl -X POST http://localhost:5000/api/bhudhi/kernel/cycle \
  -H "Content-Type: application/json" \
  -d '{"blueprintId":"<uuid>"}'

# 6. Consolidation manifest
curl http://localhost:5000/api/bhudhi/consolidation/status
```

---

**End of BHUDHI Operating System Specification**

For deployment details see [DEPLOYMENT.md](./DEPLOYMENT.md) and [PRODUCTION_RUNBOOK.md](./PRODUCTION_RUNBOOK.md).
