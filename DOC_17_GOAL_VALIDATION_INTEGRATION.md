# DOC 17: GOAL VALIDATION INTEGRATION

## INTEGRATION POINT: Genesis Domain (Goal Input -> Validation -> Blueprint)

> Alignment note: The shipped implementation uses `/api/blueprints` (draft creation) and `/api/validation/run` (Erector validation) rather than `/api/blueprints/validate`.

### Flow Diagram

```
USER ENTERS GOAL
  ↓
Clarity Catalyst Interpretation (frameworks 417-426)
  ├─ Parse goal structure
  ├─ Identify ambiguities
  └─ Produce cleaned goal
  ↓
Business Reality Blueprint Check (frameworks 1-10)
  ├─ Is goal achievable?
  ├─ Do resources exist?
  ├─ Is capability available?
  └─ Can timeline be met?
  ↓
Strategy Direction Blueprint Check (frameworks 13-42)
  ├─ Is goal aligned with vision?
  ├─ Does it fit market?
  └─ Is positioning clear?
  ↓
VERDICT REACHED
  ├─ VALID: Proceed to blueprint generation
  ├─ VALID_WITH_WARNINGS: Proceed with cautions
  └─ INVALID: Block and explain
```

### Implementation Code Structure

#### Service: BlueprintValidationService

```typescript
class BlueprintValidationService {
  async validateGoal(input: BlueprintValidationInput): Promise<ValidationResult> {
    // Step 1: Clarity Catalyst interprets
    const interpreted = await this.clarifyGoal(input);

    // Step 2: Business Reality check
    const realityCheck = await this.checkBusinessReality(interpreted);
    if (realityCheck.blocking) {
      return { verdict: "INVALID", violations: realityCheck.violations } as any;
    }

    // Step 3: Strategy Direction check
    const strategyCheck = await this.checkStrategyDirection(interpreted);

    // Step 4: Generate paths
    const paths = await this.generatePaths(interpreted, strategyCheck);

    // Step 5: Combine results
    return this.combineResults(interpreted, realityCheck, strategyCheck, paths);
  }

  private async clarifyGoal(input: any): Promise<any> {
    // Call Clarity Catalyst frameworks
    return await bhudhi.callFrameworks(
      [417, 418, 419, 420, 421, 422, 423, 424, 425, 426],
      { goal: input.goal, purpose: input.purpose },
    );
  }

  private async checkBusinessReality(goal: any): Promise<any> {
    // Check each Business Reality Blueprint
    const blueprints = [
      "Market Reality",
      "Customer Reality",
      "Competitive Reality",
      "Resource Reality",
      "Capability Reality",
      "Financial Reality",
      "Time Reality",
      "Technology Reality",
      "Regulatory Reality",
      "Team Reality",
    ];

    const results = [];
    for (const blueprint of blueprints) {
      const check = await Blueprint.validate(blueprint, goal);
      results.push(check);
    }

    return {
      blocking: results.some((r: any) => r.isBlocking),
      violations: results.filter((r: any) => !r.passed),
    };
  }

  private async checkStrategyDirection(goal: any): Promise<any> {
    // Use StrategyCore X framework
    const strategies = ["Market Entry", "Growth Trajectory", "Positioning", "Value Proposition", "Go-to-Market"];

    return await bhudhi.evaluateFramework("StrategyCore X", { goal, strategies });
  }

  private async generatePaths(goal: any, strategyCheck: any) {
    // Generate: current path, adjusted path, alternative path
    return {
      current: this.extractCurrentPath(strategyCheck),
      adjusted: await this.generateAdjustedPath(goal, strategyCheck),
      alternative: await this.generateAlternativePath(goal),
    };
  }
}
```

### API Integration

```typescript
// Implemented contract (see artifacts/api-server/src/routes/validation.ts)
// POST /api/validation/run
// - Requires blueprintId (draft)
// - Runs validation + Erector pipeline
// - Persists validation session rows and returns identifiers for launch gating
```

### Frontend Integration (Genesis UI)

```typescript
// In Genesis Domain component
const handleValidation = async (input) => {
  setLoading(true);

  try {
    // (1) Create draft blueprint first if needed
    // (2) Run validation against the draft blueprint
    const result = await api.post("/api/validation/run", {
      blueprintId: input.blueprintId,
      goal: input.goal,
      purpose: input.purpose,
      timeframe: input.timeframe,
      tier: input.tier,
      mode: input.mode,
    });

    if (result.verdict === "VALID") {
      // Show blueprint summary, proceed to activation
      showBlueprintSummary(result);
      enableActivationButton();
    } else if (result.verdict === "VALID_WITH_WARNINGS") {
      // Show warnings but allow proceeding
      showWarnings(result.warnings);
      enableActivationButton();
    } else {
      // Show blocking issues
      showBlockingIssues(result.violations);
      disableActivationButton();
      suggestAdjustments(result.pathRecommendation.adjusted);
    }
  } finally {
    setLoading(false);
  }
};
```

