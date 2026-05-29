# DOC 22: BHUDHI QUESTION UX CATALOG (IMPLEMENTATION-ALIGNED)

## SECTION 1: PURPOSE

This document replaces the prior “46/47 fixed questions registry” concept with an **implementation-aligned Question UX catalog** that maps directly to the **already-built Bhudhi API surface**.

- **Source of truth (API):** `artifacts/api-server/src/routes/bhudhi.ts` (+ related Bhudhi routes)
- **Discovery endpoint:** `GET /api/bhudhi/routes`
- **Key principle:** A “question” is a **UI affordance** that calls an existing endpoint (or a short orchestration of endpoints), not a hard-coded `questionId` registry.

---

## SECTION 2: QUESTION UX MODEL

```typescript
type QuestionUxCategory =
  | "state"
  | "signals"
  | "conditions"
  | "tasks"
  | "feedback"
  | "investigation"
  | "recommendations"
  | "frameworks"
  | "domains"
  | "governance"
  | "security";

type HttpMethod = "GET" | "POST";

interface QuestionUxSpec {
  id: string;              // stable slug (e.g. "explain_state")
  title: string;           // UI label
  prompt: string;          // user-facing phrasing (question text)
  category: QuestionUxCategory;

  // API mapping (implementation-aligned)
  method: HttpMethod;
  path: string;            // relative API path (e.g. "/api/bhudhi/explain-state")

  // Payload contract: resolve from blueprint context + user input
  buildRequest: (ctx: QuestionUxContext) => {
    query?: Record<string, string>;
    body?: Record<string, unknown>;
  };

  // Response extraction for UI
  extractAnswer: (response: any) => {
    answer: string | null;
    confidence?: number | null;
    nextSteps?: string[];
    raw?: any;
  };
}

interface QuestionUxContext {
  blueprintId: string;
  userId: string;
  // optional: current order/task metadata, latest feedback session, etc
  orderId?: string;
  validationId?: string;
}
```

---

## SECTION 3: CANONICAL QUESTION CATALOG (MAPPED TO REAL ENDPOINTS)

### 3.1 “Explain my current state”
Maps to `POST /api/bhudhi/explain-state`

```typescript
const explainState: QuestionUxSpec = {
  id: "explain_state",
  title: "Explain my state",
  prompt: "Why am I in this condition and what should I focus on right now?",
  category: "state",
  method: "POST",
  path: "/api/bhudhi/explain-state",
  buildRequest: (_ctx) => ({ body: {} }), // server resolves active blueprint for session
  extractAnswer: (res) => ({
    answer: res?.explanation ? JSON.stringify(res.explanation) : null,
    confidence: null,
    nextSteps: [],
    raw: res,
  }),
};
```

### 3.2 “What should I do next?”
Maps to `POST /api/bhudhi/torgima/next-task`

```typescript
const nextTask: QuestionUxSpec = {
  id: "next_task_bhudhi",
  title: "Recommend next task",
  prompt: "What is the next best execution step?",
  category: "tasks",
  method: "POST",
  path: "/api/bhudhi/torgima/next-task",
  buildRequest: (ctx) => ({ body: { blueprintId: ctx.blueprintId } }),
  extractAnswer: (res) => ({
    answer: res?.nextTask ? JSON.stringify(res.nextTask) : "No recommendation yet (run investigation first).",
    confidence: typeof res?.confidence === "number" ? res.confidence : null,
    nextSteps: res?.nextSteps ?? [],
    raw: res,
  }),
};
```

### 3.3 “Diagnose what’s going wrong”
Maps to `POST /api/bhudhi/investigate` (all engines)

```typescript
const investigate: QuestionUxSpec = {
  id: "investigate",
  title: "Investigate",
  prompt: "What’s causing my execution problems right now?",
  category: "investigation",
  method: "POST",
  path: "/api/bhudhi/investigate",
  buildRequest: (ctx) => ({ body: { blueprintId: ctx.blueprintId } }),
  extractAnswer: (res) => ({
    answer: res?.investigations ? JSON.stringify(res.investigations) : null,
    confidence: null,
    nextSteps: ["POST /api/bhudhi/recommend"],
    raw: res,
  }),
};
```

### 3.4 “Give me recommendations”
Maps to `POST /api/bhudhi/recommend` (alias for intelligence pipeline)

```typescript
const recommend: QuestionUxSpec = {
  id: "recommend",
  title: "Recommendations",
  prompt: "What should I change based on the evidence?",
  category: "recommendations",
  method: "POST",
  path: "/api/bhudhi/recommend",
  buildRequest: (ctx) => ({ body: { blueprintId: ctx.blueprintId } }),
  extractAnswer: (res) => ({
    answer: res?.topRecommendation ? JSON.stringify(res.topRecommendation) : "No recommendations returned.",
    confidence: typeof res?.confidence === "number" ? res.confidence : null,
    nextSteps: res?.nextSteps ?? [],
    raw: res,
  }),
};
```

### 3.5 “What are my signals?”
Maps to `GET /api/bhudhi/signals?blueprintId=...` or `GET /api/signals/current?blueprintId=...`

```typescript
const signals: QuestionUxSpec = {
  id: "signals",
  title: "Signals",
  prompt: "What do my signals say about my execution health?",
  category: "signals",
  method: "GET",
  path: "/api/signals/current",
  buildRequest: (ctx) => ({ query: { blueprintId: ctx.blueprintId } }),
  extractAnswer: (res) => ({
    answer: res?.signal ? JSON.stringify(res.signal) : null,
    confidence: null,
    nextSteps: [],
    raw: res,
  }),
};
```

### 3.6 “What’s my condition and enforcement?”
Maps to `GET /api/condition/current?blueprintId=...`

```typescript
const condition: QuestionUxSpec = {
  id: "condition_and_enforcement",
  title: "Condition + Enforcement",
  prompt: "What constraints are active right now (task limits, difficulty cap, allowed/blocked actions)?",
  category: "conditions",
  method: "GET",
  path: "/api/condition/current",
  buildRequest: (ctx) => ({ query: { blueprintId: ctx.blueprintId } }),
  extractAnswer: (res) => ({
    answer: JSON.stringify({ condition: res?.condition, enforcement: res?.enforcement }),
    confidence: null,
    nextSteps: [],
    raw: res,
  }),
};
```

### 3.7 “Clarify missing feedback context”
Maps to `GET /api/feedback/:id/interrogation` and `POST /api/feedback/:id/interrogation`

```typescript
const feedbackInterrogation: QuestionUxSpec = {
  id: "feedback_interrogation",
  title: "Clarify feedback",
  prompt: "Bhudhi needs clarification—answer the follow-up question.",
  category: "feedback",
  method: "GET",
  path: "/api/feedback/:id/interrogation",
  buildRequest: (ctx) => ({ /* UI supplies feedbackId for :id */ }),
  extractAnswer: (res) => ({
    answer: res?.questions ? JSON.stringify(res.questions) : null,
    confidence: null,
    nextSteps: [],
    raw: res,
  }),
};
```

---

## SECTION 4: CLIENT IMPLEMENTATION SHAPE (HIGH LEVEL)

```typescript
class BhudhiQuestionUxService {
  constructor(private api: { get: Function; post: Function }) {}

  async run(spec: QuestionUxSpec, ctx: QuestionUxContext) {
    const req = spec.buildRequest(ctx);

    const url =
      spec.method === "GET"
        ? this.applyQuery(spec.path, req.query ?? {})
        : spec.path;

    const res =
      spec.method === "GET"
        ? await this.api.get(url)
        : await this.api.post(url, req.body ?? {});

    return spec.extractAnswer(res);
  }

  private applyQuery(path: string, query: Record<string, string>) {
    const qs = new URLSearchParams(query).toString();
    return qs ? `${path}?${qs}` : path;
  }
}
```

---

## SECTION 5: DEPRECATION NOTE (OLD DOC 22)

The prior fixed numeric registry (Q1–Q46/Q47), plus direct `TriggerRouter.callClaude(...)` usage, is deprecated for this repo because:
- It conflicts with the implemented Bhudhi modular endpoint design.
- It referenced private router methods and inconsistent `subframes/subframeworks` fields.

If you still want a fixed “46-question” UX, it should be implemented as **a UI-only catalog** on top of the endpoints above (or as a thin `/api/bhudhi/questions/*` façade), not as the primary system contract.

