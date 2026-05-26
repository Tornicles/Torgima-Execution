# BHUDHI API Reference

HTTP API for the Bhudhi intelligence layer in Torgima-Execution.

**Base URL:** Configured via `VITE_API_BASE_URL` (frontend) or your API host.  
**Auth:** Most routes require `USER_SESSION` (cookie or equivalent).  
**Blueprint scope:** Pass `blueprintId` (UUID) in query or JSON body; server verifies ownership.

**Envelope:** Responses use `bhudhiSuccess` / standard API envelope — see `artifacts/api-server/src/bhudhi/api/bhudhiApiEnvelope.ts`.

---

## Consolidation & discovery

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bhudhi/consolidation/status` | Phase 2 manifest: layers, migrations, routes |
| GET | `/api/bhudhi/health` | Bhudhi catalog health (seed check) |
| GET | `/api/bhudhi/monitoring/health` | Deep layer health (kernel, memory, runtime) |
| GET | `/api/bhudhi/monitoring/metrics` | Bhudhi + platform metrics bundle |
| GET | `/api/bhudhi/certification` | Bhudhi Readiness Score (BRS) scorecard |
| GET | `/api/bhudhi/launch/status` | Launch readiness manifest (Prompt 40) |
| GET | `/api/bhudhi/launch/config` | Environment + pricing tiers |
| POST | `/api/bhudhi/launch/onboard` | Bhudhi launch onboarding (auth) |
| GET | `/api/bhudhi/launch/limits` | Tier blueprint limits for current user |
| POST | `/api/telemetry` | Telemetry batch ingestion |
| GET | `/api/bhudhi/civilizations` | List civilizations (`?blueprintId=`) |
| POST | `/api/bhudhi/civilization/create` | Civilization observe cycle (BCIE) |
| POST | `/api/bhudhi/civilization/simulate-years` | Multi-year simulation + inflection points |
| POST | `/api/bhudhi/civilization/forecast` | Long-horizon forecast 1–100 years |
| POST | `/api/bhudhi/civilization/resilience` | Resilience score + stress tests |
| GET | `/api/bhudhi/expansion/status` | BAEE governance status |
| POST | `/api/bhudhi/expansion/discover` | Capability discovery |
| POST | `/api/bhudhi/expansion/approve` | Human approve/reject |
| POST | `/api/bhudhi/expansion/rollback` | Rollback capability |
| GET | `/api/metrics` | Same metrics (plain JSON, uptime tools) |
| GET | `/api/health` | Platform production health |
| GET | `/api/bhudhi/status` | Systems, engines, frameworks summary |

---

## Kernel (Prompt 31)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bhudhi/kernel/cycle` | Run full cognitive cycle |
| GET | `/api/bhudhi/kernel/context` | Shared context + validation |
| GET | `/api/bhudhi/kernel/events` | List events (`blueprintId`, optional `chainId`) |
| GET | `/api/bhudhi/kernel/registry` | Engine registry |

### Run cycle

```http
POST /api/bhudhi/kernel/cycle
Content-Type: application/json

{ "blueprintId": "00000000-0000-4000-8000-000000000001" }
```

**Response fields:** `chainId`, `eventIds`, `status` (`completed` | `failed`), `cycle` (context snapshot).

### Get context

```http
GET /api/bhudhi/kernel/context?blueprintId=<uuid>
```

---

## Memory graph (Prompt 32)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bhudhi/memory/query` | Query nodes (and related edges) |
| GET | `/api/bhudhi/memory/stats` | Node/edge counts by type |
| POST | `/api/bhudhi/memory/migrate` | Migrate legacy data into graph |
| GET | `/api/bhudhi/memory/timeline` | Timeline entries |
| GET | `/api/bhudhi/memory/related` | Nodes related to `nodeId` |
| POST | `/api/bhudhi/memory/node` | Upsert a node |
| POST | `/api/bhudhi/memory/consolidate` | Group nodes by type |

### Query

```http
POST /api/bhudhi/memory/query
Content-Type: application/json

{
  "blueprintId": "<uuid>",
  "nodeTypes": ["decision", "signal"],
  "query": "context",
  "limit": 20
}
```

### Stats

```http
GET /api/bhudhi/memory/stats?blueprintId=<uuid>
```

---

## Protocol (Prompt 33)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bhudhi/protocol/send` | Send BHUDHI:// message |
| POST | `/api/bhudhi/protocol/route` | Route existing message by id |
| GET | `/api/bhudhi/protocol/history` | Message history |
| GET | `/api/bhudhi/protocol/routes` | Registered routes + examples |
| POST | `/api/bhudhi/protocol/contracts` | Upsert engine contract |
| GET | `/api/bhudhi/protocol/validate` | Parse/validate URI |

### Send (with auto-route)

```http
POST /api/bhudhi/protocol/send
Content-Type: application/json

{
  "blueprintId": "<uuid>",
  "from": "investigation",
  "to": "intelligence",
  "uri": "bhudhi://investigation/complete",
  "payload": { "investigations": [] },
  "messageType": "event",
  "autoRoute": true
}
```

---

## Execution runtime (Prompt 35)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bhudhi/runtime/execute` | Unified execution (all types) |
| GET | `/api/bhudhi/execution/stats` | Success rate, counts by type |
| GET | `/api/bhudhi/runtime/history` | Recent execution contexts |
| GET | `/api/bhudhi/runtime/context` | Single execution (`executionId`, `blueprintId`) |

### Unified execute

```http
POST /api/bhudhi/runtime/execute
Content-Type: application/json

{
  "blueprintId": "<uuid>",
  "executionType": "task",
  "payload": { "title": "Ship milestone", "status": "pending" }
}
```

**executionType:** `decision` | `simulation` | `team` | `organization` | `task`

**decision payload tip:** include `recommendationId` (approved) to invoke operating pipeline.

### Legacy recommendation execute (Prompt 4 / Operating)

```http
POST /api/bhudhi/execute
Content-Type: application/json

{
  "blueprintId": "<uuid>",
  "recommendationId": "<uuid>"
}
```

This path is **not** the unified runtime; it runs security validation + `OperatingService.executeRecommendation`.

---

## Investigation & intelligence (foundation)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bhudhi/investigate` | Run investigations |
| POST | `/api/bhudhi/recommend` | Generate recommendations |
| GET | `/api/bhudhi/insights` | Insights and learnings |
| GET | `/api/bhudhi/recommendations/:blueprintId` | List recommendations |

---

## Signals & governance

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bhudhi/signals` | Current signals |
| POST | `/api/bhudhi/signals` | Recalculate signals |

---

## Frameworks & domains

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bhudhi/frameworks` | List frameworks |
| POST | `/api/bhudhi/frameworks` | Evaluate framework |
| GET | `/api/bhudhi/domains` | List domains |
| GET | `/api/bhudhi/domains/current` | Current domain for blueprint |

---

## Torgima integration

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/torgima/bhudhi/state` | Unified Torgima + Bhudhi state (Prompt 39) |
| POST | `/api/torgima/bhudhi/execute` | Convergence: kernel cycle + proposed order |
| POST | `/api/torgima/bhudhi/feedback` | Convergence: feedback + re-cycle |
| POST | `/api/bhudhi/torgima/next-task` | Next task recommendation |
| POST | `/api/bhudhi/torgima/validate-goal` | Erector goal validation |
| GET | `/api/bhudhi/modules` | Bhudhi 2.0 modules |
| POST | `/api/bhudhi/modules/complete-cycle` | Module complete cycle |

---

## External systems

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bhudhi/external/connect` | Connect external system |
| POST | `/api/bhudhi/external/sync` | Sync external data |
| GET | `/api/bhudhi/external/connections` | List connections |

---

## Specialized engine routes (Prompts 1–30)

Each engine has its own router under `/api/bhudhi/…` — examples:

| Prefix | Engine |
|--------|--------|
| `/api/bhudhi/economics` | Economics |
| `/api/bhudhi/decision` | Decision |
| `/api/bhudhi/beliefs` | Beliefs |
| `/api/bhudhi/world` | World model |
| `/api/bhudhi/identity` | Identity |
| `/api/bhudhi/organization` | Organization |
| `/api/bhudhi/experiments` | Experiments |
| `/api/bhudhi/teams` | Teams |
| `/api/bhudhi/erector` | Erector runtime |
| `/api/bhudhi/civilization` | Civilization |
| `/api/bhudhi/expansion` | AGI expansion |
| `/api/bhudhi/temporal` | Temporal |
| `/api/bhudhi/governor` | Meta governor |
| `/api/bhudhi/reliability` | Reliability |
| `/api/bhudhi/security` | Security engine |
| `/api/bhudhi/infrastructure` | Infrastructure |

See route files in `artifacts/api-server/src/routes/bhudhi*.ts` for full method lists.

---

## Canonical route catalog (code)

The array `BHUDHI_API_ROUTES` in `artifacts/api-server/src/bhudhi/api/BhudhiCatalogService.ts` is the machine-readable catalog used in tests. When adding routes, update that array and this document.

---

## Error responses

| HTTP | Code | Meaning |
|------|------|---------|
| 422 | `VALIDATION_ERROR` | Missing/invalid `blueprintId` or body |
| 404 | `NOT_FOUND` | Blueprint or execution not found |
| 401 | — | Not authenticated |

---

## Related documentation

- [BHUDHI_OS_SPEC.md](./BHUDHI_OS_SPEC.md) — operating manual
- [BHUDHI_ARCHITECTURE_DIAGRAMS.md](./BHUDHI_ARCHITECTURE_DIAGRAMS.md) — diagrams
- [BHUDHI_CONSOLIDATION_PHASE.md](./BHUDHI_CONSOLIDATION_PHASE.md) — Phase 2 checklist
