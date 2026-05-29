# DOC 24: OUTPUT VALIDATION & FALLBACK SYSTEM

## SECTION 1: RESPONSE VALIDATION PIPELINE

```typescript
interface OutputValidationResult {
  passed: boolean;
  violations: ValidationViolation[];
  confidence_adjustment: number;
  fallback_applied: boolean;
}

class OutputValidationService {
  async validateBhudhhiOutput(
    response: BhudhhiResponse,
    route: BhudhhiRoute,
    context: TriggerContext
  ): Promise<OutputValidationResult> {
    const violations: ValidationViolation[] = [];
    let confidenceAdjust = 1.0;

    // Validation 1: Mode compliance
    const modeViolations = this.checkModeCompliance(response, route.mode);
    violations.push(...modeViolations);
    if (modeViolations.length > 0) {
      confidenceAdjust *= 0.7;
    }

    // Validation 2: Framework grounding
    const frameworkViolations = this.checkFrameworkGrounding(
      response,
      route.frameworks,
      route.subFrameworks
    );
    violations.push(...frameworkViolations);
    if (frameworkViolations.length > 0) {
      confidenceAdjust *= 0.8;
    }

    // Validation 3: Mutation attempts
    const mutationViolations = this.checkMutationAttempts(response);
    violations.push(...mutationViolations);
    if (mutationViolations.length > 0) {
      confidenceAdjust *= 0.5;
    }

    // Validation 4: Context coherence
    const coherenceViolations = this.checkContextCoherence(
      response,
      context
    );
    violations.push(...coherenceViolations);
    if (coherenceViolations.length > 0) {
      confidenceAdjust *= 0.85;
    }

    // Validation 5: Blueprint alignment
    const blueprintViolations = await this.checkBlueprintAlignment(
      response,
      context.blueprintId
    );
    violations.push(...blueprintViolations);
    if (blueprintViolations.length > 0) {
      confidenceAdjust *= 0.75;
    }

    // Determine if fallback needed
    const critical = violations.filter(v => v.severity === "critical");

    return {
      passed: violations.length === 0,
      violations,
      confidence_adjustment: confidenceAdjust,
      fallback_applied: critical.length > 0
    };
  }

  private checkModeCompliance(
    response: BhudhhiResponse,
    mode: string
  ): ValidationViolation[] {
    const violations: ValidationViolation[] = [];
    const text = (response.answer + response.reasoning).toLowerCase();

    // Forbidden words by mode
    const forbidden = {
      "INTERPRET": ["created", "approved", "decided", "updated", "implemented"],
      "STRUCTURE": ["decided", "chosen", "approved", "implemented"],
      "DRAFT": ["decided", "approved", "implemented"],
      "EXPLAIN": ["decided", "created", "implemented"],
      "SUGGEST": ["decided", "implemented"]
    };

    for (const word of (forbidden[mode] || [])) {
      if (text.includes(` ${word} `) || text.startsWith(word)) {
        violations.push({
          type: "mode_violation",
          severity: "warning",
          message: `Mode ${mode} cannot use word: ${word}`
        });
      }
    }

    return violations;
  }

  private checkFrameworkGrounding(
    response: BhudhhiResponse,
    frameworks: string[],
    subframes: number[]
  ): ValidationViolation[] {
    const violations: ValidationViolation[] = [];

    // Check: Does response cite frameworks used?
    if (!response.frameworks_used || response.frameworks_used.length === 0) {
      violations.push({
        type: "framework_grounding",
        severity: "warning",
        message: "Response doesn't cite frameworks used"
      });
    }

    // Check: Are cited frameworks in allowed set?
    if (response.frameworks_used) {
      const disallowed = response.frameworks_used.filter(
        f => !frameworks.includes(f)
      );

      if (disallowed.length > 0) {
        violations.push({
          type: "framework_violation",
          severity: "critical",
          message: `Response uses disallowed frameworks: ${disallowed.join(", ")}`
        });
      }
    }

    return violations;
  }

  private checkMutationAttempts(response: BhudhhiResponse): ValidationViolation[] {
    const violations: ValidationViolation[] = [];
    const text = JSON.stringify(response).toUpperCase();

    const mutationPatterns = [
      "UPDATE BLUEPRINT",
      "CREATE TASK",
      "CHANGE CONDITION",
      "ACTIVATE FRAMEWORK",
      "OVERRIDE SIGNAL",
      "BLOCK EXECUTION",
      "DELETE",
      "MODIFY",
      "ENFORCE",
      "APPROVE"
    ];

    for (const pattern of mutationPatterns) {
      if (text.includes(pattern)) {
        violations.push({
          type: "mutation_attempt",
          severity: "critical",
          message: `Attempted mutation: ${pattern}`
        });
      }
    }

    return violations;
  }
}

interface ValidationViolation {
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
}
```

---

## SECTION 2: FALLBACK SYSTEM

```typescript
class FallbackSystem {
  async getFallback(
    trigger: string,
    context: TriggerContext,
    validationFailure: ValidationViolation[]
  ): Promise<BhudhhiResponse> {
    // Step 1: Determine fallback type
    const fallbackType = this.determineFallbackType(trigger, validationFailure);

    // Step 2: Load fallback template
    const template = this.loadFallbackTemplate(trigger, fallbackType);

    // Step 3: Inject context
    const fallback = this.injectContext(template, context);

    // Step 4: Return fallback response
    return fallback;
  }

  private determineFallbackType(
    trigger: string,
    violations: ValidationViolation[]
  ): string {
    // Critical violations → full fallback
    if (violations.some(v => v.severity === "critical")) {
      return "full";
    }

    // Multiple warnings → partial fallback
    if (violations.filter(v => v.severity === "warning").length > 2) {
      return "partial";
    }

    // Single warning → light fallback
    return "light";
  }

  private loadFallbackTemplate(trigger: string, type: string): BhudhhiResponse {
    const templates = {
      "goal_submission": {
        full: {
          reasoning: "Using fallback due to validation failure",
          answer: "I cannot validate this goal fully right now. Can you clarify your intended outcome?",
          confidence: 0.4,
          frameworks_used: ["Clarity Catalyst"]
        }
      },
      "task_generated": {
        full: {
          reasoning: "Using fallback template",
          answer: "This task is assigned because it advances your current goal.",
          confidence: 0.5,
          frameworks_used: ["StrategyCore X"]
        }
      },
      // [More fallbacks for each trigger]
    };

    return templates[trigger]?.[type] || templates.default.full;
  }

  private injectContext(template: BhudhhiResponse, context: TriggerContext): BhudhhiResponse {
    return {
      ...template,
      reasoning: template.reasoning.replace("{{goal}}", context.goal),
      answer: template.answer.replace("{{condition}}", context.condition)
    };
  }
}
```

---

## SECTION 3: MONITORING & ALERTING

```typescript
class BhudhhiMonitor {
  async trackPerformance(
    trigger: string,
    response: BhudhhiResponse,
    validation: OutputValidationResult
  ): Promise<void> {
    // Log metrics
    await BhudhhiMetrics.create({
      trigger,
      response_confidence: response.confidence,
      validation_passed: validation.passed,
      violations_count: validation.violations.length,
      fallback_used: validation.fallback_applied,
      timestamp: new Date()
    });

    // Alert on failures
    if (validation.fallback_applied) {
      await this.alertFallbackUsed(trigger, validation.violations);
    }

    // Track timeout frequency
    // Track mutation attempt frequency
    // Alert on pattern anomalies
  }
}
```

