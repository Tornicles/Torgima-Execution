# Torgima ↔ Bhudhi Convergence (Prompt 39)

Deep integration between Torgima goal execution and the Bhudhi intelligence layer.

## Flow

```
User input
    ↓
Torgima (goal → blueprint → orders)
    ↓
Convergence layer (map, sync, signal → condition)
    ↓
Bhudhi cognitive kernel (investigate → recommend → preserve)
    ↓
Proposed / created next order
    ↓
Feedback loop → re-cycle
```

## API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/torgima/bhudhi/state?blueprintId=` | Unified snapshot (blueprint, order, Bhudhi) |
| POST | `/api/torgima/bhudhi/execute` | Run kernel cycle + optional order creation |
| POST | `/api/torgima/bhudhi/feedback` | Process feedback + re-run convergence |

### Execute body

```json
{
  "blueprintId": "<uuid>",
  "createOrder": false,
  "syncRecommendations": false
}
```

- `createOrder: true` — inserts a **pending** Torgima order from the proposed instruction
- `syncRecommendations: true` — upserts up to 3 Bhudhi recommendations as pending orders

### Feedback body

```json
{
  "blueprintId": "<uuid>",
  "orderId": "<uuid>",
  "feedback": { "completed": true, "score": 90, "reflection": "..." }
}
```

## Implementation

| Module | Path |
|--------|------|
| ConvergenceLayer | `artifacts/api-server/src/bhudhi/convergence/ConvergenceLayer.ts` |
| TorgimaBhudhiBridge | `artifacts/api-server/src/bhudhi/convergence/TorgimaBhudhiBridge.ts` |
| Routes | `artifacts/api-server/src/routes/torgimaBhudhiConvergence.ts` |
| Dashboard | `/app/bhudhi/convergence` or `/app/torgima-bhudhi` |

## Signal → control mapping

| Bhudhi signal | Torgima control posture |
|---------------|------------------------|
| nothingness | clarify |
| danger | recover |
| urgency | accelerate |
| stability | maintain |
| power | scale |
| affluence | optimize |
| power_change | transition |

Blueprint `current_condition` and `metadata.convergence` are updated after each execute cycle.

## Related legacy routes

- `POST /api/bhudhi/torgima/next-task` — lightweight next-task text
- `POST /api/bhudhi/torgima/validate-goal` — Erector goal validation
- Feedback pipeline — `FeedbackProcessingEngine` + `runBhudhiFeedbackCycle`

Convergence is the **unified** orchestration path on top of the cognitive kernel (Prompt 31).
