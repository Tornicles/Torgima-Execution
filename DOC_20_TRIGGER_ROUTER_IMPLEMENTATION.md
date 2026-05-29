# DOC 20: TRIGGER ROUTER IMPLEMENTATION

## SECTION 1: TRIGGER TYPES (Complete Enumeration)

### TORGIMA TRIGGER TYPES (16 total)

```typescript
enum TorgimaTriggger {
  // Goal/Blueprint triggers
  GOAL_SUBMISSION = "goal_submission",
  GOAL_VALIDATION = "goal_validation",
  BLUEPRINT_CREATED = "blueprint_created",
  BLUEPRINT_ACTIVATED = "blueprint_activated",

  // Domain transitions
  DOMAIN_ENTERED = "domain_entered",
  DOMAIN_EXITED = "domain_exited",

  // Execution triggers
  TASK_GENERATED = "task_generated",
  TASK_COMPLETED = "task_completed",
  TASK_BLOCKED = "task_blocked",

  // Signal/Condition triggers
  SIGNAL_UPDATED = "signal_updated",
  CONDITION_CHANGED = "condition_changed",
  CONDITION_SUSTAINED = "condition_sustained",

  // Framework triggers
  FRAMEWORK_ACTIVATED = "framework_activated",
  FRAMEWORK_VETO = "framework_veto",

  // Escalation triggers
  ESCALATION_TRIGGERED = "escalation_triggered",
  FEEDBACK_SUBMITTED = "feedback_submitted"
}
```

### BHUDHI TRIGGER TYPES (8 total)

```typescript
enum BhudhhiTrigger {
  // User question
  USER_QUESTION = "user_question",

  // System analysis
  SYSTEM_ANALYSIS = "system_analysis",
  ANOMALY_DETECTED = "anomaly_detected",

  // Suggestion triggers
  IMPROVEMENT_SUGGESTED = "improvement_suggested",
  PATTERN_DETECTED = "pattern_detected",

  // Recovery triggers
  FAILURE_DETECTED = "failure_detected",
  RESET_TRIGGERED = "reset_triggered",

  // Context update
  CONTEXT_UPDATE = "context_update"
}
```

---

## SECTION 2: TRIGGER ROUTER LOGIC

### TriggerRouter Service

```typescript
class TriggerRouter {
  private routeMap: Map<string, BhudhhiRoute[]>;

  constructor() {
    this.initializeRoutes();
  }

  // Main router entry point
  async route(trigger: BhudhhiTrigger | TorgimaTriggger, context: TriggerContext): Promise<BhudhhiResponse> {
    // Step 1: Validate trigger
    if (!this.isValidTrigger(trigger)) {
      throw new Error(`Invalid trigger: ${trigger}`);
    }

    // Step 2: Get applicable routes
    const routes = this.routeMap.get(trigger) || [];

    if (routes.length === 0) {
      console.warn(`No routes found for trigger: ${trigger}`);
      return this.returnNullResponse(trigger);
    }

    // Step 3: Determine active route based on context
    const activeRoute = this.selectRoute(routes, context);

    // Step 4: Load frameworks & sub-frameworks
    const frameworkConfig = await this.loadFrameworkConfig(activeRoute);

    // Step 5: Build Bhudhi request
    const bhudhhiRequest = this.buildRequest(
      trigger,
      context,
      activeRoute,
      frameworkConfig
    );

    // Step 6: Call Claude API with Bhudhi configuration
    const response = await this.callClaude(bhudhhiRequest);

    // Step 7: Validate response
    const validated = await this.validateResponse(response, activeRoute);

    // Step 8: Log decision
    await this.logDecision(trigger, context, activeRoute, response);

    return validated;
  }

  // Initialize trigger-to-route mappings
  private initializeRoutes(): void {
    // GOAL_SUBMISSION → validate goal against 50 blueprints
    this.routeMap.set(TorgimaTriggger.GOAL_SUBMISSION, [
      {
        name: "goal_validation_route",
        priority: 1,
        frameworks: ["Clarity Catalyst", "StrategyCore X"],
        subFrameworks: [417, 418, 419, 420, 421, 422, 423, 424, 425, 426, 1, 2, 3, 4, 5, 6],
        mode: "INTERPRET",
        timeout: 2000
      }
    ]);

    // TASK_GENERATED → explain why task assigned
    this.routeMap.set(TorgimaTriggger.TASK_GENERATED, [
      {
        name: "task_explanation_route",
        priority: 1,
        frameworks: ["StrategyCore X", "TalentSync X"],
        subFrameworks: [6, 28, 351, 367, 407, 427],
        mode: "EXPLAIN",
        timeout: 1500
      }
    ]);

    // FEEDBACK_SUBMITTED → calculate signal & explain
    this.routeMap.set(TorgimaTriggger.FEEDBACK_SUBMITTED, [
      {
        name: "feedback_analysis_route",
        priority: 1,
        frameworks: ["KnowledgeFlow X", "DecisionVelocity X"],
        subFrameworks: [275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 43, 44, 45],
        mode: "STRUCTURE",
        timeout: 1000
      }
    ]);

    // USER_QUESTION → answer using 46 question routing
    this.routeMap.set(BhudhhiTrigger.USER_QUESTION, [
      {
        name: "question_answer_route",
        priority: 1,
        frameworks: [], // Determined by question ID
        subFrameworks: [], // Determined by question ID
        mode: "EXPLAIN",
        timeout: 2000
      }
    ]);

    // CONDITION_CHANGED → interpret change
    this.routeMap.set(TorgimaTriggger.CONDITION_CHANGED, [
      {
        name: "condition_interpretation_route",
        priority: 1,
        frameworks: ["DecisionVelocity X", "AdaptiveIntelligence X"],
        subFrameworks: [43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 361, 362, 363, 364, 365],
        mode: "INTERPRET",
        timeout: 1000
      }
    ]);

    // FRAMEWORK_VETO → explain veto
    this.routeMap.set(TorgimaTriggger.FRAMEWORK_VETO, [
      {
        name: "veto_explanation_route",
        priority: 1,
        frameworks: ["Governance & Risk X"],
        subFrameworks: [81, 82, 83, 84, 85, 86, 87, 88, 89, 90],
        mode: "EXPLAIN",
        timeout: 1000
      }
    ]);

    // [Additional 10+ routes...]
  }

  // Select best route based on context
  private selectRoute(routes: BhudhhiRoute[], context: TriggerContext): BhudhhiRoute {
    // Sort by priority
    routes.sort((a, b) => a.priority - b.priority);

    // If multiple routes with same priority, check context
    const bestPriority = routes[0].priority;
    const candidates = routes.filter(r => r.priority === bestPriority);

    if (candidates.length === 1) {
      return candidates[0];
    }

    // Select based on context (condition, tier, etc)
    for (const route of candidates) {
      if (this.routeMatches(route, context)) {
        return route;
      }
    }

    // Default to first
    return candidates[0];
  }

  // Build request to Claude API
  private buildRequest(
    trigger: string,
    context: TriggerContext,
    route: BhudhhiRoute,
    frameworkConfig: FrameworkConfig
  ): ClaudeRequest {
    // Build system prompt with framework context
    const systemPrompt = this.buildSystemPrompt(route, frameworkConfig);

    // Build user message with context
    const userMessage = this.buildUserMessage(trigger, context, route);

    return {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        { role: "user", content: userMessage }
      ]
    };
  }

  // Build system prompt that includes framework context
  private buildSystemPrompt(route: BhudhhiRoute, config: FrameworkConfig): string {
    return `You are Bhudhi, the AI intelligence layer in Torgima.

MODE: ${route.mode}
Your mode is "${route.mode}". You can INTERPRET, STRUCTURE, DRAFT, EXPLAIN, and occasionally SUGGEST.
You CANNOT DECIDE, MUTATE, OVERRIDE, or CREATE OFFICIAL EXECUTION.

FRAMEWORKS ACTIVE: ${route.frameworks.join(", ")}
These frameworks guide your reasoning: ${JSON.stringify(config.activeFrameworks)}

SUB-FRAMEWORKS: ${route.subFrameworks.join(", ")}
Evidence from these sub-frameworks available: ${JSON.stringify(config.evidence)}

CONSTRAINTS:
- Response must be grounded in the frameworks above
- Must cite framework evidence when reasoning
- Output is advisory only (never commands)
- Must be concise and actionable
- If asked to decide/override, decline and explain why

BLUEPRINT CONTEXT:
${JSON.stringify(config.blueprintContext)}

Respond in clear, direct language. Explain your reasoning using framework evidence.`;
  }

  // Build user message with trigger context
  private buildUserMessage(trigger: string, context: TriggerContext, route: BhudhhiRoute): string {
    let message = `TRIGGER: ${trigger}\n\n`;

    message += `CONTEXT:\n`;
    message += `Goal: ${context.goal}\n`;
    message += `Blueprint: ${context.blueprintId}\n`;
    message += `Condition: ${context.condition}\n`;
    message += `Signal: ${JSON.stringify(context.signal)}\n\n`;

    message += `REQUEST: ${context.request}\n\n`;

    message += `FRAMEWORKS: ${route.frameworks.join(", ")}\n`;
    message += `MODE: ${route.mode}\n\n`;

    message += `Respond in JSON with: { reasoning: string, answer: string, confidence: number, frameworks_used: string[] }`;

    return message;
  }

  // Call Claude API with timeout and fallback
  private async callClaude(request: ClaudeRequest): Promise<any> {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY
        },
        body: JSON.stringify(request)
      });

      const data = await response.json();

      // Extract text from response
      const text = data.content
        .filter((block: any) => block.type === "text")
        .map((block: any) => block.text)
        .join("");

      return JSON.parse(text);
    } catch (error) {
      console.error("Claude API error:", error);
      throw error;
    }
  }
}

interface TriggerContext {
  goal: string;
  blueprintId: string;
  condition: string;
  signal: Signal;
  request: string;
  userId: string;
  tier: string;
  context?: any;
}

interface BhudhhiRoute {
  name: string;
  priority: number;
  frameworks: string[];
  subFrameworks: number[];
  mode: "INTERPRET" | "STRUCTURE" | "DRAFT" | "EXPLAIN" | "SUGGEST";
  timeout: number;
}

interface FrameworkConfig {
  activeFrameworks: any[];
  evidence: any[];
  blueprintContext: any;
}
```

---

## SECTION 3: RESPONSE VALIDATION

```typescript
interface BhudhhiResponse {
  reasoning: string;
  answer: string;
  confidence: number;
  frameworks_used: string[];
  subframeworks_used?: number[];
  mode_respected: boolean;
  mutations_attempted: number;
}

async function validateResponse(
  response: any,
  route: BhudhhiRoute
): Promise<BhudhhiResponse> {
  const validated = {
    reasoning: response.reasoning || "",
    answer: response.answer || "",
    confidence: Math.min(1, Math.max(0, response.confidence || 0.5)),
    frameworks_used: response.frameworks_used || [],
    subframeworks_used: response.subframeworks_used || [],
    mode_respected: checkModeRespected(response, route.mode),
    mutations_attempted: detectMutationAttempts(response)
  };

  // Check for mode violations
  if (!validated.mode_respected) {
    console.warn(`Mode violation detected in response`);
    validated.confidence *= 0.5; // Reduce confidence
  }

  // Check for mutation attempts
  if (validated.mutations_attempted > 0) {
    console.warn(`${validated.mutations_attempted} mutation attempts detected`);
    validated.answer = "[Mutation attempt blocked] " + validated.answer;
  }

  return validated;
}

function checkModeRespected(response: any, mode: string): boolean {
  const violations = {
    "INTERPRET": ["created", "approved", "decided", "updated"],
    "STRUCTURE": ["created", "approved", "decided"],
    "DRAFT": ["approved", "decided"],
    "EXPLAIN": ["created", "approved", "decided"],
    "SUGGEST": ["approved", "decided"]
  };

  const text = (response.answer + response.reasoning).toLowerCase();

  for (const violation of violations[mode] || []) {
    if (text.includes(violation)) {
      return false;
    }
  }

  return true;
}

function detectMutationAttempts(response: any): number {
  const mutations = [
    "UPDATE blueprint",
    "CREATE task",
    "CHANGE condition",
    "ACTIVATE framework",
    "OVERRIDE signal",
    "BLOCK execution"
  ];

  let count = 0;
  const text = JSON.stringify(response).toUpperCase();

  for (const mutation of mutations) {
    if (text.includes(mutation)) count++;
  }

  return count;
}
```

