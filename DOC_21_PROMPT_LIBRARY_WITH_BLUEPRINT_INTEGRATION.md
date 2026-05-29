# DOC 21: PROMPT LIBRARY WITH BLUEPRINT INTEGRATION (600+ PROMPTS)

## SECTION 1: PROMPT ORGANIZATION (By Framework + Trigger)

### FRAMEWORK-BASED PROMPTS (14 frameworks × 40 prompts = 560)

```typescript
// Example: StrategyCore X Prompt Library (42 prompts)

const strategyPrompts = {
  // Goal Validation Prompts (10)
  goal_validation_1: {
    name: "Is this goal strategically sound?",
    framework: "StrategyCore X",
    subframes: [1, 2, 3],
    mode: "INTERPRET",
    prompt: `Given the goal: {{goal}}
    And current vision: {{vision}}
    And competitive position: {{position}}

    Is this goal strategically coherent? Assess:
    1. Does it align with our chosen competitive arena?
    2. Does it reinforce our advantage?
    3. Does it fit the 3-year vision?

    Respond with: {alignment: 0-10, reasoning: string, recommendation: string}`
  },

  goal_validation_2: {
    name: "Does this goal fit our market position?",
    framework: "StrategyCore X",
    subframes: [4, 5, 6],
    mode: "INTERPRET",
    prompt: `Goal: {{goal}}
    Current market position: {{position}}
    Target customer segment: {{segment}}

    Check market fit: {{marketFitChecklist}}

    Is this achievable in our market position? Respond with market feasibility assessment.`
  },

  // [8 more goal validation prompts]

  // Path Generation Prompts (10)
  path_generation_1: {
    name: "Generate current path",
    framework: "StrategyCore X",
    subframes: [13, 14, 15, 16],
    mode: "DRAFT",
    prompt: `Goal: {{goal}}
    Current resources: {{resources}}
    Competitive landscape: {{landscape}}

    Draft the most direct path using current position. Respond with:
    {phases: [{name, duration, milestones}], risks: [], advantages: []}`
  },

  // [More path generation prompts]

  // Coherence Check Prompts (8)
  // Advantage Check Prompts (8)
  // [etc]
};

// Example: DecisionVelocity X Prompt Library (38 prompts)
const velocityPrompts = {
  momentum_measurement_1: {
    name: "What is our current momentum?",
    framework: "DecisionVelocity X",
    subframes: [43, 44, 45],
    mode: "INTERPRET",
    prompt: `Recent completion rate: {{completion}}
    Quality trend: {{trend}}
    Consistency: {{consistency}}
    Days in current condition: {{daysInCondition}}

    Calculate momentum score (0-10) and trend direction.`
  },

  // [37 more velocity prompts]
};

// [Similar for all 14 frameworks, total 560 prompts]
```

---

### TRIGGER-BASED PROMPTS (16 triggers × 3-4 prompts = 50)

```typescript
const triggerPrompts = {
  // GOAL_SUBMISSION prompts
  goal_submission_interpret: {
    trigger: "GOAL_SUBMISSION",
    mode: "INTERPRET",
    prompt: `User submitted goal: "{{rawGoal}}"

    Interpret what they're actually trying to achieve. Consider:
    1. Explicit meaning
    2. Implicit intention
    3. Hidden concerns
    4. Unstated context

    Respond: {cleanedGoal: string, implicitIntention: string, concerns: string[]}`
  },

  goal_submission_structure: {
    trigger: "GOAL_SUBMISSION",
    mode: "STRUCTURE",
    prompt: `Goal: {{goal}}
    Timeframe: {{timeframe}}
    Commitment: {{commitment}}

    Structure this goal into:
    1. Clear outcome (what success looks like)
    2. Success criteria (measurable)
    3. Non-value (what is explicitly not included)

    Respond: {outcome: string, criteria: string[], nonValue: string[]}`
  },

  // [Additional goal submission prompts + other triggers]
};
```

---

## SECTION 2: DYNAMIC PROMPT GENERATION

```typescript
class DynamicPromptGenerator {
  async generatePrompt(
    framework: string,
    subframeworks: number[],
    context: TriggerContext,
    mode: string
  ): Promise<string> {
    // Step 1: Load base prompt
    const basePrompt = this.loadBasePrompt(framework, subframeworks);

    // Step 2: Inject context variables
    let prompt = basePrompt;
    prompt = this.injectContext(prompt, context);

    // Step 3: Add framework constraints
    prompt = this.addFrameworkConstraints(prompt, framework, subframeworks);

    // Step 4: Add mode-specific instructions
    prompt = this.addModeInstructions(prompt, mode);

    // Step 5: Add blueprint context
    prompt = this.addBlueprintContext(prompt, context.blueprintId);

    return prompt;
  }

  private injectContext(prompt: string, context: TriggerContext): string {
    return prompt
      .replace("{{goal}}", context.goal)
      .replace("{{condition}}", context.condition)
      .replace("{{signal}}", JSON.stringify(context.signal))
      .replace("{{blueprintId}}", context.blueprintId)
      .replace("{{userId}}", context.userId)
      .replace("{{tier}}", context.tier);
  }

  private addFrameworkConstraints(
    prompt: string,
    framework: string,
    subframeworks: number[]
  ): string {
    const constraints = this.getFrameworkDoctrines(framework);

    return prompt + `

FRAMEWORK CONSTRAINTS:
${constraints.join("\n")}

Use only frameworks ${subframeworks.join(", ")} in your reasoning.`;
  }

  private addModeInstructions(prompt: string, mode: string): string {
    const modeGuides = {
      "INTERPRET": "Explain what's happening and why, without making decisions.",
      "STRUCTURE": "Organize information clearly, without evaluating.",
      "DRAFT": "Create draft content that can be reviewed and modified.",
      "EXPLAIN": "Make something understandable, with clear reasoning.",
      "SUGGEST": "Offer a limited suggestion with heavy caveats."
    };

    return prompt + `

MODE: ${mode}
${modeGuides[mode]}
You CANNOT decide, mutate, or override. You CAN explain, structure, draft, and suggest.`;
  }

  private addBlueprintContext(prompt: string, blueprintId: string): Promise<string> {
    // Load applicable blueprints for context
    const blueprints = await this.getApplicableBlueprints(blueprintId);

    return prompt + `

APPLICABLE BLUEPRINTS:
${blueprints.map(b => `- ${b.name}: ${b.relevance}`).join("\n")}

Ensure reasoning respects these blueprint constraints.`;
  }
}
```

