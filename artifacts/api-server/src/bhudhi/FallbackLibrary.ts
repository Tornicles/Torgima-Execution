import type { BhudhiOutputEnvelope } from "../types/bhudhi.js";

type FallbackFn = (ctx: Record<string, unknown>, stateVersion: number) => BhudhiOutputEnvelope;

const fallbacks = new Map<string, FallbackFn>();

fallbacks.set("fallback.goal_structure", (ctx, sv) => ({
  outputType: "structured_goal",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "LOW",
  data: {
    cleanedGoal:           (ctx["rawGoal"] as string) ?? "",
    purpose:               (ctx["purpose"] as string) ?? "",
    timeframe:             (ctx["timeframe"] as string) ?? "",
    commitmentLevel:       (ctx["commitmentLevel"] as string) ?? "MEDIUM",
    domainHints:           [],
    ambiguityFlags:        [],
    missingRequiredFields: getMissingGoalFields(ctx),
  },
  missingFields:           getMissingGoalFields(ctx),
  warnings:                ["AI structuring unavailable — deterministic fallback used"],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.task_copy", (ctx, sv) => ({
  outputType: "task_copy",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "MEDIUM",
  data: {
    title:                ((ctx["actionContext"] as string) ?? "Next execution step").slice(0, 80),
    instruction:          `Complete the next concrete step toward your goal: "${((ctx["goal"] as string) ?? "your goal").slice(0, 150)}". Be specific about what you will do and what output you will produce.`,
    proofInstruction:     "Describe what you completed and what changed as a result.",
    successCriteria:      ["The task is done and you can describe the output"],
    estimatedEffortLabel: "MEDIUM",
    userFacingReason:     "This advances your blueprint toward your goal.",
  },
  missingFields:           [],
  warnings:                ["AI task drafting unavailable — template used"],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.blocker_classification", (ctx, sv) => ({
  outputType: "blocker_classification",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "LOW",
  data: {
    blockerCategory:           "OTHER",
    severity:                  "MEDIUM",
    needsDependencyResolution: false,
    needsRecoveryTask:         true,
    summary:                   "Blocker needs further review. A recovery task has been suggested.",
  },
  missingFields:           [],
  warnings:                ["AI classification unavailable — fallback category used"],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.clarification", (ctx, sv) => ({
  outputType: "clarification_request",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "HIGH",
  data: {
    question:      `What specific information do you need to continue with: ${(ctx["taskTitle"] as string) ?? "this task"}?`,
    requiredField: (ctx["requiredField"] as string) ?? "context",
    answerType:    "TEXT",
    choices:       [],
    whyNeeded:     "This information is needed to continue execution.",
  },
  missingFields:           [],
  warnings:                [],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.state_explanation", (ctx, sv) => ({
  outputType: "state_explanation",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "MEDIUM",
  data: {
    headline:         `Current state: ${(ctx["condition"] as string) ?? "active"}`,
    explanation:      "Your execution system is running. Your next task is ready when you are.",
    nextActionReason: "Completing the next task keeps your execution momentum.",
    reassurance:      undefined,
    displayTone:      "CALM",
  },
  missingFields:           [],
  warnings:                ["AI explanation unavailable — template used"],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.recovery_copy", (ctx, sv) => ({
  outputType: "recovery_copy",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "HIGH",
  data: {
    title:          "Return to Execution",
    instruction:    `Choose one small concrete action toward: "${((ctx["goal"] as string) ?? "your goal").slice(0, 100)}". Complete it and submit feedback.`,
    expectedOutput: "One completed action with feedback.",
    tone:           "CALM",
  },
  missingFields:           [],
  warnings:                [],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.academy_instruction", (ctx, sv) => ({
  outputType: "academy_instruction",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "MEDIUM",
  data: {
    title:                `Learn: ${((ctx["capabilityGap"] as string) ?? "core skill").slice(0, 40)}`,
    instruction:          `Spend 15 minutes on fundamentals related to: ${((ctx["capabilityGap"] as string) ?? "this gap").slice(0, 200)}.`,
    practiceTask:         "Write one sentence on what you learned and one action you will try next.",
    proofOfUnderstanding: "Share your sentence and the action you chose.",
  },
  missingFields:           [],
  warnings:                ["AI academy drafting unavailable — template used"],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.evidence_summary", (ctx, sv) => ({
  outputType: "evidence_summary",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "LOW",
  data: {
    submittedEvidenceSummary:  "Evidence could not be analyzed automatically.",
    evidenceTypesDetected:     [],
    missingEvidenceHints:      ["Provide specific, measurable evidence for your claimed outcome."],
    contradictionsOrWeaknesses: [],
    validationRecommendation:  "NEEDS_MORE_EVIDENCE",
  },
  missingFields:           [],
  warnings:                ["AI evidence analysis unavailable — fallback used"],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.root_cause", (ctx, sv) => ({
  outputType: "root_cause_candidates",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "LOW",
  data: {
    candidates: [
      { category: "CLARITY",   likelihood: "MEDIUM", evidence: ["Pattern analysis unavailable"] },
      { category: "CAPACITY",  likelihood: "MEDIUM", evidence: ["Pattern analysis unavailable"] },
    ],
    recommendedNextDiagnosticQuestion: "What specifically stopped you from completing the last task?",
  },
  missingFields:           [],
  warnings:                ["AI root cause analysis unavailable — fallback used"],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.reality_intelligence", (ctx, sv) => {
  const domain = String(ctx["domain"] ?? "business");
  return {
    outputType: "reality_intelligence",
    contractVersion: "1.0",
    stateVersion: sv,
    confidence: "LOW",
    data: {
      marketMomentum: "growing",
      similarCompanies: [
        {
          name: "Early-stage competitor",
          reason: "Similar problem space",
          outcome: "succeeded",
          lesson: "Execution consistency was the differentiator",
        },
      ],
      positioning: {
        strongestAngle: `Direct execution focus in ${domain}`,
        weakestAngle: "Awareness and distribution",
        userMisconception: "Users may see this as another planning tool",
        differentiationOpportunity: "Real execution tracking, not just planning",
      },
      whiteSpace: {
        underservedUsers: ["Serious operators who need accountability"],
        emotionalGaps: ["Gap between intention and consistent execution"],
        executionGaps: ["No system that forces daily real-world action"],
        unclaimedPositioning: ["Execution OS for individual operators"],
      },
      strategicWarnings: ["Avoid feature creep", "Distribution is the hardest problem"],
      competitorWeaknesses: [
        "Most tools are planners not executors",
        "No real accountability mechanism",
      ],
      blueprintSeedingInstructions:
        "Build phases around real-world execution milestones. Tasks must be specific operational commands, not generic suggestions.",
    },
    missingFields: [],
    warnings: ["AI reality intelligence unavailable — deterministic fallback used"],
    forbiddenActionRequested: false,
  };
});

function getMissingGoalFields(ctx: Record<string, unknown>): string[] {
  const missing: string[] = [];
  const raw = ctx["rawGoal"] as string | undefined;
  if (!raw || raw.trim().length < 5)  missing.push("goal");
  const purpose = ctx["purpose"] as string | undefined;
  if (!purpose || purpose.trim().length < 5)  missing.push("purpose");
  if (!ctx["timeframe"])                                               missing.push("timeframe");
  if (!ctx["commitmentLevel"])                                         missing.push("commitment");
  return missing;
}

export function getFallback(key: string, ctx: Record<string, unknown>, stateVersion: number): BhudhiOutputEnvelope {
  const fn = fallbacks.get(key);
  if (!fn) {
    return {
      outputType:               "recovery_copy",
      contractVersion:         "1.0",
      stateVersion,
      confidence:              "LOW",
      data:                    {
        title: "Continue",
        instruction: "Take one small step on your blueprint and log feedback when done.",
        expectedOutput: "Feedback submitted.",
        tone: "CALM",
      },
      missingFields:           [],
      warnings:                [`No fallback registered for key: ${key}`],
      forbiddenActionRequested: false,
    };
  }
  return fn(ctx, stateVersion);
}
