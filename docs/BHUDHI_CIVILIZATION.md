# Bhudhi Civilization Intelligence Engine (Prompt 29)

**BCIE** extends Bhudhi from individual/team/organization scale to **civilization-scale** systems: population, institutions, economy, ecosystem, and long-horizon (1–100 year) forecasting.

**Principle:** Civilization intelligence **advises only** — it never governs execution reality or controls humans.

## Architecture

```
artifacts/api-server/src/bhudhi/civilization/
├── civilization-engine/CivilizationEngine.ts  — orchestration
├── population/PopulationEngine.ts
├── institutions/CivilInstitutionEngine.ts
├── economy/CivilEconomy.ts
├── ecosystems/EcosystemEngine.ts
├── evolution/EvolutionEngine.ts + LongHorizonEngine.ts
├── resilience/CivilResilience.ts
├── governance/CivilGovernance.ts
├── policy/CivilizationPolicy.ts
└── civilizationData.ts — Drizzle persistence
```

## Database

Migration: `migrations/0024_bhudhi_civilization_intelligence_engine.sql`

| Table | Purpose |
|-------|---------|
| `bhudhi_civilizations` | Civilization identity + state |
| `bhudhi_civilization_states` | Per-cycle snapshots |
| `bhudhi_civilization_events` | Event log |
| `bhudhi_civilization_forecasts` | Horizon forecasts |
| `bhudhi_civilization_memory` | Blueprint-scoped memory |

Apply with `pnpm db:migrate`.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bhudhi/civilizations?blueprintId=` | List civilizations |
| POST | `/api/bhudhi/civilization/create` | Observe / create cycle |
| POST | `/api/bhudhi/civilization/simulate` | Single simulation pass |
| POST | `/api/bhudhi/civilization/evolve` | Evolution pass |
| POST | `/api/bhudhi/civilization/forecast` | Horizons 1, 5, 10, 25, 100 years |
| POST | `/api/bhudhi/civilization/resilience` | Score + stress tests |
| POST | `/api/bhudhi/civilization/simulate-years` | Multi-year series + inflection points |
| POST | `/api/bhudhi/civilization/inflection-points` | Trajectory shifts only |
| POST | `/api/bhudhi/civilization/history` | Historical records |

All routes require `USER_SESSION` and blueprint ownership.

### Example — create + forecast

```http
POST /api/bhudhi/civilization/create
{ "blueprintId": "<uuid>", "name": "Blueprint Civilization" }

POST /api/bhudhi/civilization/forecast
{ "blueprintId": "<uuid>" }

POST /api/bhudhi/civilization/simulate-years
{ "blueprintId": "<uuid>", "horizonYears": 100 }
```

## Dashboard

- Universal: `/app/bhudhi/civilization?blueprintId=<uuid>`
- Legacy page: `/app/bhudhi/civilization` (same route via universal layout)

Views: population, institutions, economy, resilience, evolution, long-horizon forecast, 20-year simulation chart.

## Policy constraints

`CivilizationPolicy` blocks forbidden constraints such as `CONTROL_HUMANS` and `REMOVE_UNCERTAINTY`. Allowed: `simulate`, `forecast`, `recommend`.

## Verification

```bash
cd artifacts/api-server
pnpm exec vitest run src/tests/unit/bhudhi/bhudhi-civilization-engine.test.ts
```

## Next

Prompt 30 — AGI Expansion Engine (depends on BCIE complete).
