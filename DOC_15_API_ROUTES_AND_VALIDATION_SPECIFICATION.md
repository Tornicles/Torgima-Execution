# DOC 15: API ROUTES & VALIDATION SPECIFICATION

## SECTION 1: NEW API ROUTES (Blueprint/Framework Integrated)

> Note (Alignment): The production codebase already ships a canonical API surface under `artifacts/api-server/src/routes/`.
> This document is aligned to that implementation-first contract to avoid spec/code drift.

### Route 1: POST /api/validation/run
**Purpose:** Validate goal inputs for a draft blueprint (Erector + validation pipeline) and return a validation session/result that can be launched.

**Request:**

```typescript
{
  blueprintId: string; // uuid
  goal: string;
  purpose?: string;
  timeframe?: string;
  commitmentLevel?: "low" | "medium" | "high" | "full";
  currentContext?: string;
  successSignal?: string;
  knownBlockers?: string;
  domainHint?: string;
  tier?: "starter" | "growth" | "ultimate";
  mode?: "individual" | "team";
}
```

**Validation Logic:**

```
1. Persist/attach validation session to the blueprint
2. Run Erector validation pipeline and produce:
   - verdict (blocked/adjust/current/pivot-style outputs in existing system)
   - scores + paths + first-week plan (when applicable)
3. Return validation contract id and session id for launch gating
```

**Response:**

```typescript
{
  // Actual response shape varies by pipeline stage; always includes identifiers
  validationId: string;
  validationContractId?: string;
  blueprintId: string;
  verdict: string;
  redirectTo?: string;
}
```

**Error Handling:**
- 400: Invalid input structure
- 422: Validation failed (return details)
- 500: System error (log + return generic)

**Performance Target:** < 2 seconds

---

### Route 2: POST /api/blueprints/:id/activate
**Purpose:** Launch/activate a blueprint from a completed validation contract and selected path type.

**Request:**

```typescript
{
  selectedPath?: "current" | "adjusted" | "alternative";
  selectedBlueprintLevel?: "starter" | "growth" | "ultimate";
  validationContractId?: string;
  validationId?: string;
  tier?: "starter" | "growth" | "ultimate";
  domain?: string;
  timeframe?: string;
  commitment_level?: string;
  purpose?: string;
}
```

**Logic:**

```
1. Resolve validation contract (explicit id, or latest for blueprint)
2. Enforce launch gating (must have validation)
3. Launch blueprint via BlueprintLaunchService
4. Blueprint transitions to active execution state
```

**Response:**

```typescript
{
  // Launch result includes blueprint activation state (implementation-defined)
  idempotent?: boolean;
  blueprintId: string;
  selectedPathType: "current" | "adjusted" | "alternative";
}
```

**Performance Target:** < 1 second

---

### Route 3: GET /api/tasks/queue?blueprintId=...
**Purpose:** Read the current visible execution queue snapshot (never-empty principle) with display pattern metadata.

**Request:**

```typescript
{
  // query param: blueprintId=<uuid>
}
```

**Logic:**

```
1. Read task queue snapshot for blueprint (visible today + hidden horizon)
2. Derive day-pattern visualization labels
3. Return stable snapshot payload
```

**Response:**

```typescript
{
  visibleToday: any[];
  hiddenHorizon: any[];
  horizonDays: number;
  todayPattern: any;
  visiblePattern: string[]; // ["F"|"G"|"O"...]
  principles: {
    visibleQueue: string;
    hiddenQueue: string;
    neverRunsOut: true;
  };
}
```

**Performance Target:** < 1.5 seconds (Bhudhi enabled)

---

### Route 4: POST /api/tasks/queue/fill
**Purpose:** Trigger a deterministic fill/regeneration of the queue (manual or system-triggered), then return updated snapshot.

**Request:**

```typescript
{
  blueprintId: string;
}
```

**Logic:**

```
1. Gather all raw metrics
2. Apply Business Reality Blueprint validation
3. Calculate core metrics (completion, score, momentum)
4. Validate against expected patterns (blueprints)
5. Adjust confidence based on blueprint alignment
6. Return validated signal
```

**Response:**

```typescript
{
  signal: Signal;
  metrics: {
    completionRate: number;
    qualityScore: number;
    momentum: number;
    trend: number;
    confidence: number;
  };
  blueprintValidation: BlueprintValidationResult;
  anomalies: Anomaly[];
}
```

**Performance Target:** < 500ms

---

### Route 5: GET /api/signals/current?blueprintId=...
**Purpose:** Return the persisted current signal snapshot + current condition display package (execution chain output).

**Request:**

```typescript
{
  signal: Signal;
  blueprintId: string;
  condition?: Condition; // previous
}
```

**Logic:**

```
1. Governance & Risk framework checks (frameworks 81-124)
2. DecisionVelocity framework evaluates
3. Apply signal-to-condition mapping
4. Enforce framework veto rules
5. Return enforced condition
```

**Response:**

```typescript
{
  condition: Condition;
  reasoning: string;
  frameworksEnforced: string[];
  enforcementPackage: EnforcementPackage;
}
```

**Performance Target:** < 300ms

---

### Route 6: GET /api/condition/current?blueprintId=...
**Purpose:** Return current condition + current enforcement package (task limits, difficulty cap, allowed/blocked actions).

**Request:**

```typescript
// query param: blueprintId=<uuid>
```

**Logic:**

```
1. Load current condition row (is_current=true)
2. Load current enforcement package row (is_current=true)
3. Return display spec + enforcement fields used by UI
```

**Response:**

```typescript
{
  blueprintId: string;
  display: any;
  frameworkSignals: any;
  condition: {
    condition: string;
    durationDays: number;
    escalationLevel: number;
    recoveryRequired: boolean;
    previousCondition?: string;
    transitionReason?: string;
  } | null;
  enforcement: {
    id: string;
    taskLimits: any;
    difficultyCap: string;
    allowedActions: string[];
    blockedActions: string[];
    phasePermission?: string;
    aiMode?: string;
    uiMode?: string;
    riskLevel?: string;
  } | null;
}
```

**Performance Target:** < 500ms

---

### Route 7: POST /api/feedback/submit
**Purpose:** Submit structured feedback (session-based) which drives the signal/condition/control cascade.

**Response:**

```typescript
{
  // Implementation-defined session outcome; should include session + derived signals snapshot
  submitted: boolean;
}
```

---

## SECTION 2: VALIDATION MIDDLEWARE

### Blueprint Validation Middleware

```typescript
async function validateAgainstBlueprints(
  input: any,
  applicableBlueprints: string[]
): Promise<ValidationResult> {
  const results = [];

  for (const blueprint of applicableBlueprints) {
    const check = await Blueprint.validate(blueprint, input);
    results.push(check);
  }

  const allPass = results.every(r => r.passed);
  return {
    passed: allPass,
    details: results,
    confidence: calculateConfidence(results)
  };
}
```

### Framework Constraint Enforcement

```typescript
async function enforceFrameworkConstraints(
  decision: any,
  activeFrameworks: Framework[]
): Promise<EnforcedDecision> {
  let enforced = decision;

  // Apply in authority order
  for (const framework of FRAMEWORK_AUTHORITY_ORDER) {
    if (activeFrameworks.includes(framework)) {
      const constraints = await framework.getConstraints();
      enforced = await constraints.apply(enforced);
    }
  }

  return enforced;
}
```

---

## SECTION 3: ERROR HANDLING & FALLBACKS

### Fallback Strategy

```
IF Bhudhi times out (> 2 seconds):
  → Use template fallback task
  → Generate simple task based on pattern
  → Run Bhudhi async in background
  → Update task when Bhudhi completes

IF Blueprint validation fails:
  → Return list of violations
  → Suggest adjustments
  → Block execution (do not proceed)

IF Framework conflicts unresolvable:
  → Use authority hierarchy
  → Log conflict
  → Escalate if critical

IF Signal anomaly detected:
  → Flag anomaly
  → Use previous signal as baseline
  → Alert system for investigation
```

---

## SECTION 4: RATE LIMITING & PERFORMANCE

### Rate Limits (per user, per hour)

```
/api/blueprints (draft create): 200 calls
/api/validation/run: 100 calls
/api/blueprints/:id/activate: 200 calls
/api/tasks/queue: 2000 calls
/api/tasks/queue/fill: 500 calls
/api/signals/current: 2000 calls
/api/condition/current: 2000 calls
/api/feedback/*: 1000 calls
/api/bhudhi/*: tier-based throttling; monitor by engine latency and token usage
```

### Caching Strategy

```
Cache (5 minutes):
- Framework authority hierarchy
- Blueprint validation rules
- Sub-framework definitions
- Bhudhi route manifest (GET /api/bhudhi/routes)

Cache (30 minutes):
- Evaluated signal baseline
- Active blueprint state
- User capability profile

Never cache:
- Individual task generation
- Real-time signal calculation
- User-specific decisions
```

