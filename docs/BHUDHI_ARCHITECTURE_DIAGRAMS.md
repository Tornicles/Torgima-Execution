# BHUDHI Architecture Diagrams

Visual reference for Bhudhi 2.0 after Phase 2 consolidation (Prompts 31–35).

See also: [BHUDHI_OS_SPEC.md](./BHUDHI_OS_SPEC.md)

---

## System flow diagram

```
┌──────────────┐
│ User /       │
│ Torgima      │  goals, orders, feedback, validation
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│           BHUDHI COGNITIVE KERNEL (31)           │
│  ┌────────────────────────────────────────────┐ │
│  │  Investigation → Intelligence → Security   │ │
│  │       ↓              ↓            ↓       │ │
│  │              Operating → Preservation       │ │
│  └────────────────────────────────────────────┘ │
│                      │                          │
│              EVENT BUS (persisted)              │
└──────────────────────┬───────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
│ SHARED      │ │ MEMORY      │ │ BHUDHI://       │
│ CONTEXT     │ │ GRAPH (32)  │ │ PROTOCOL (33)   │
└──────┬──────┘ └──────┬──────┘ └────────┬────────┘
       │               │                  │
       └───────────────┼──────────────────┘
                       ▼
              ┌─────────────────┐
              │ EXECUTION       │
              │ RUNTIME (35)    │
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │ DASHBOARD       │
              │ /app/bhudhi(34) │
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │ USER FEEDBACK   │
              └─────────────────┘
```

---

## Kernel cycle (sequential pipeline)

```
POST /api/bhudhi/kernel/cycle
         │
         ▼
┌────────────────────┐
│ investigateBlueprint│──► sharedContext.investigations
└─────────┬──────────┘
          │ event: investigation.complete
          │ protocol: bhudhi://investigation/complete
          ▼
┌────────────────────┐
│ analyzeAndRecommend │──► sharedContext.strategy, .ideas
└─────────┬──────────┘
          │ event: intelligence.complete
          ▼
┌────────────────────┐
│ validateRecommendation│
└─────────┬──────────┘
     valid │                    invalid
          ▼                        ▼
┌────────────────────┐    security.rejected
│ executeRecommendation│
└─────────┬──────────┘
          │ event: operating.complete
          ▼
┌────────────────────┐
│ consolidateKnowledge│──► sharedContext.knowledge
└─────────┬──────────┘
          │ event: preservation.complete
          ▼
┌────────────────────┐
│ syncCycleToMemoryGraph │
│ kernel.cycle.complete  │
└────────────────────┘
```

---

## Event bus vs protocol vs kernel events

```
┌─────────────────────────────────────────────────────────┐
│                    SAME CYCLE, THREE VIEWS             │
├─────────────────────────────────────────────────────────┤
│ bhudhi_kernel_events     EventBus.publish()            │
│   (audit trail)            (in-process + persist)       │
├─────────────────────────────────────────────────────────┤
│ bhudhi_protocol_messages  recordProtocolStep()         │
│   (BHUDHI:// URIs)         (dual-write per stage)       │
├─────────────────────────────────────────────────────────┤
│ bhudhi_memory_timeline    syncCycleToGraph()            │
│   (graph timeline)         (after cycle success)        │
└─────────────────────────────────────────────────────────┘
```

---

## Memory graph structure

```
                    ┌──────────────┐
                    │ MemoryNode   │
                    │ type + id    │
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌──────────────┐
   │ Edge     │     │ Timeline │     │ Relationship │
   │ depends  │     │ event    │     │ contradicts  │
   │ supports │     │ snapshot │     │ (pairwise)   │
   └──────────┘     └──────────┘     └──────────────┘

Query path: POST /api/bhudhi/memory/query
           GET  /api/bhudhi/memory/related?nodeId=
```

---

## Protocol routing

```
POST /api/bhudhi/protocol/send
         │
         ▼
┌─────────────────┐     parse URI
│ BhudhiProtocol  │──── bhudhi://intelligence/recommend
│ .send()         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     pattern: bhudhi://intelligence/*
│ ProtocolRouter  │──── handler → service call
│ .route()        │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
 acknowledge  EventBus.publish
 (processed)  (optional fan-out)
```

---

## Execution runtime (unified)

```
POST /api/bhudhi/runtime/execute
{ executionType, payload }
         │
         ▼
┌─────────────────┐
│ UnifiedExecutor │
└────────┬────────┘
         │
    ┌────┼────┬────────────┬──────┐
    ▼    ▼    ▼            ▼      ▼
 decision simulation team organization task
    │    │    │            │      │
    └────┴────┴────────────┴──────┘
                 │
                 ▼
        ExecutionRuntime
        (context, steps, feedback, result)
                 │
                 ▼
        bhudhi_unified_execution_*
```

**Separate path:** `POST /api/bhudhi/execute` = legacy recommendation-only operating pipeline.

---

## Signal → condition → control (governance)

```
Execution metrics + investigations
              │
              ▼
     Signal engines / calculate
              │
              ▼
        Global signal + confidence
              │
              ▼
   Governance console + conditions
              │
              ▼
   Control recommendations (non-overriding)
              │
              ▼
   Operating / runtime (when approved)
```

---

## Deployment topology

```
┌─────────────────┐         ┌──────────────────────────┐
│ Vercel          │  HTTPS  │ Railway / Fly / Render   │
│ artifacts/      │ ──────► │ artifacts/api-server     │
│ torgima (SPA)   │         │ Express + workers        │
│ /app/bhudhi     │         │ Bhudhi routes            │
└─────────────────┘         └────────────┬─────────────┘
                                           │
                                           ▼
                                ┌──────────────────────┐
                                │ PostgreSQL           │
                                │ migrations 0001-0029 │
                                │ bhudhi_* tables      │
                                └──────────────────────┘
```

---

## Component interaction (five systems)

```
        ┌───────────────┐
        │ Investigation │
        └───────┬───────┘
                │ findings
                ▼
        ┌───────────────┐
        │ Intelligence  │◄──── Preservation (learnings)
        └───────┬───────┘
                │ recommendations
                ▼
        ┌───────────────┐
        │ Security      │
        └───────┬───────┘
           approve│reject
                ▼
        ┌───────────────┐
        │ Operating     │
        └───────┬───────┘
                │ results
                ▼
        ┌───────────────┐
        │ Preservation  │
        └───────────────┘
```

---

## Dashboard information architecture

```
/app/bhudhi
├── (overview)     status, signals, quick links
├── execution      kernel + runtime
├── intelligence   investigate, recommend, insights
├── governance     signals, frameworks
├── memory         graph stats, timeline
├── protocol       routes, history
├── systems        5 systems + engine deep links
└── settings       blueprint id, external links
```

Legacy engine pages remain at `/app/bhudhi/economics`, `/app/bhudhi/erector`, etc., linked from Systems.
