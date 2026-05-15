/**
 * Bhudhi intelligence map — descriptive contract only.
 * Bhudhi is a strategic intelligence layer, not an execution authority.
 */

export const BHUDHI_INTELLIGENCE_MAP = {
  REALITY_INTELLIGENCE: {
    purpose: "Convert user goal and purpose into grounded strategic framing",
    inputs: ["rawGoal", "purpose", "domain", "timeframe", "commitmentLevel"],
    enhances: [
      "market direction framing",
      "ecosystem trend interpretation",
      "demand confidence framing",
      "competitive archetype comparison",
      "execution timing framing",
      "strategic risk identification",
    ],
    cannotDo: [
      "declare success",
      "fake live market data",
      "override validation verdict",
      "bypass signal authority",
    ],
    outputShape: {
      marketMomentum: "growing | declining | emerging | oversaturated | behavior_shifting",
      demandConfidence: "high | medium | low",
      trendExplanation: "string",
      similarConcepts: "Array<{ name, reason, outcome, lesson, differentiationInsight }>",
      timingAnalysis: "{ risk, opportunity, urgency, reason }",
      blueprintSeedInstructions: "string",
      executionImplication: "string",
    },
    fallbackBehavior: "Deterministic domain archetypes",
  },

  COMMAND_ORDER_INTELLIGENCE: {
    purpose: "Improve order copy (wording, proof language) within enforcement limits",
    inputs: ["taskContent", "action", "project", "phase", "domain", "condition", "intelligence"],
    enhances: [
      "operational wording for the same allowed order",
      "strategic reason text",
      "where / how guidance",
      "proof language",
      "done criteria wording",
      "unlock consequence explanation",
    ],
    cannotDo: [
      "exceed condition task limits",
      "bypass difficulty cap",
      "create orders outside blueprint position",
      "fabricate hierarchy or trace chains",
    ],
    outputShape: {
      command: "string",
      title: "string",
      requiredOutput: "string",
      doneCriteria: "string",
      proof: "string",
      where: "string",
      how: "string",
      unlockConsequence: "string",
      aiPromptIfNeeded: "string | null",
      platformIfNeeded: "string | null",
    },
    fallbackBehavior: "Deterministic command copy from templates",
    rule: "Trace chain and unlock rules come from blueprint + dependencies — computed server-side.",
  },

  EXECUTION_ATMOSPHERE: {
    purpose: "Operational language norms for UI and copy",
    languageRules: {
      banned: ["Great job", "Keep going", "To-do", "task manager", "tips", "Nice work", "Don't give up"],
      required: [
        "Execution order",
        "Execution chain",
        "Signal state",
        "Blueprint position",
        "Operational intelligence",
        "Reality alignment",
      ],
    },
    systemPersonality: "Strategic, calm, operational — not motivational.",
  },
} as const;
