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

fallbacks.set("fallback.task_copy", (ctx, sv) => {
  if (ctx["commandOrderMode"] === true) {
    const taskTitle = String(ctx["taskTitle"] ?? ctx["actionContext"] ?? "Next execution order").slice(0, 120);
    const mins = Number(ctx["timeEstimateMinutes"] ?? 45);
    return {
      outputType: "task_copy",
      contractVersion: "1.0",
      stateVersion: sv,
      confidence: "LOW",
      data: {
        title: taskTitle.slice(0, 80),
        command: `Execute now: ${taskTitle}. Complete within ${mins} minutes, produce proof, and submit an execution report.`,
        requiredOutput: `Completed "${taskTitle}" with a measurable artifact (link, screenshot, or written outcome).`,
        doneCriteria:
          "(1) Real-world execution happened — not planned only. (2) Proof artifact exists. (3) You can describe what changed.",
        proof: "Screenshot, link, or dated notes proving completion.",
        where: String(ctx["whereHint"] ?? "Use the primary environment for your domain."),
        how: "Most direct path. If blocked for 10+ minutes, document the blocker and submit anyway.",
        unlockConsequence: "Maintains blueprint progression signal quality for the active execution chain.",
        successCriteria: ["Execution completed or blocker documented with specificity"],
        estimatedEffortLabel: "MEDIUM",
        userFacingReason: String(
          ctx["intelligenceHint"] ?? "This advances the active blueprint under current condition enforcement.",
        ),
        proofInstruction: "Attach proof consistent with enforcement (image/text as required).",
        aiPromptIfNeeded: null,
        platformIfNeeded: null,
      },
      missingFields: [],
      warnings: ["AI command drafting unavailable — deterministic command template used"],
      forbiddenActionRequested: false,
    };
  }

  return {
    outputType: "task_copy",
    contractVersion: "1.0",
    stateVersion: sv,
    confidence: "MEDIUM",
    data: {
      title: ((ctx["actionContext"] as string) ?? "Next execution step").slice(0, 80),
      instruction: `Complete the next concrete step toward your goal: "${((ctx["goal"] as string) ?? "your goal").slice(0, 150)}". Be specific about what you will do and what output you will produce.`,
      proofInstruction: "Describe what you completed and what changed as a result.",
      successCriteria: ["The task is done and you can describe the output"],
      estimatedEffortLabel: "MEDIUM",
      userFacingReason: "This advances your blueprint toward your goal.",
    },
    missingFields: [],
    warnings: ["AI task drafting unavailable — template used"],
    forbiddenActionRequested: false,
  };
});

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
    explanation:      "Blueprint position is advancing. Next execution order awaits when enforcement allows.",
    nextActionReason: "Completing the next execution order strengthens signal coherence.",
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

fallbacks.set("fallback.restart_copy", (ctx, sv) => ({
  outputType: "restart_copy",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "LOW",
  data: {
    title: "One small step back in",
    instruction: `Complete one low-friction action toward: "${String(ctx["goal"] ?? "your goal").slice(0, 100)}".`,
    welcomeMessage: "Welcome back — momentum returns with a single completed step.",
  },
  missingFields: [],
  warnings: ["AI restart copy unavailable — deterministic fallback"],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.academy_instruction", (ctx, sv) => ({
  outputType: "academy_instruction",
  contractVersion: "1.1",
  stateVersion: sv,
  confidence: "MEDIUM",
  data: {
    title:                `Capability: ${((ctx["skillCategory"] as string) ?? (ctx["capabilityGap"] as string) ?? "core skill").slice(0, 40)}`,
    instruction:          `Apply this execution skill: ${((ctx["capabilityGap"] as string) ?? "close the gap").slice(0, 200)}.`,
    practiceTask:         "Produce one work sample showing deliberate capability application.",
    proofOfUnderstanding: "Submit mastery evidence matching the definition.",
  },
  missingFields:           [],
  warnings:                ["AI academy drafting unavailable — template used"],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.academy_skill_assessment", (ctx, sv) => ({
  outputType: "academy_skill_assessment",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "LOW",
  data: {
    masteryScore: Number(ctx["completionScore"] ?? 5) / 10,
    evidenceAnalysis: "Automated fallback — review proof manually.",
    masteredCriteria: [],
    missingCriteria: ["proof_quality"],
  },
  missingFields: [],
  warnings: ["AI skill assessment unavailable — fallback used"],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.academy_gap_severity", (ctx, sv) => ({
  outputType: "academy_gap_severity",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "LOW",
  data: {
    severity: "MEDIUM",
    evidenceSummary: "Gap severity assessed from failure pattern (fallback).",
    recommendedLessons: 3,
    fastestPathToResolution: "Route to capability development path.",
  },
  missingFields: [],
  warnings: ["AI gap severity unavailable — fallback used"],
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

const realityIntelFallbackFn: FallbackFn = (ctx, sv) => {
  const domain = String(ctx["domain"] ?? ctx["goalDomain"] ?? "genesis");
  return {
    outputType: "reality_intelligence",
    contractVersion: "2.0",
    stateVersion: sv,
    confidence: "LOW",
    data: {
      marketMomentum: "growing",
      demandConfidence: "medium",
      trendExplanation: `Strategic framing: ${domain} favors operators who publish proof-of-work rather than intentions.`,
      similarConcepts: [
        {
          name: "Operator-first execution tooling",
          reason: "Bridges intention to verified action with accountability",
          outcome: "succeeded",
          lesson: "Retention correlates with proof rituals, not feature breadth",
          differentiationInsight: "Win on reality enforcement mechanics others treat as secondary",
        },
        {
          name: "Planner-centric productivity stacks",
          reason: "Adjacent UX without systemic enforcement",
          outcome: "failed",
          lesson: "Voluntary accountability fails past day-30 churn cliffs",
          differentiationInsight: "Own execution headquarters — not planning surface area",
        },
      ],
      positioning: {
        strongestAngle: `Reality-aligned execution rails in ${domain}`,
        weakestAngle: "Distribution and expectation calibration",
        userMisconception: "Risk of mistaken identity as generic assistant",
        differentiationPath: "Own execution infrastructure + proof coupling",
        positioningRule: "Only measured reality progresses state — never narrative intent alone",
      },
      whiteSpace: {
        underservedUsers: ["Operators who demand external accountability loops"],
        emotionalGaps: ["Shame-after-repeated-planning loops without proof"],
        executionGaps: ["No lightweight linkage between proofs and progression"],
        competitorWeaknesses: ["Assume discipline is user's problem, not system design"],
        unclaimedPositioning: ["Individual execution headquarters", "Reality-first progression rails"],
        opportunityPath: "Claim proof-before-scale positioning while AI-plan noise peaks",
      },
      timingAnalysis: {
        risk: "Planner commoditization from generic AI wrappers",
        opportunity: "Backlash creates appetite for enforced reality loops",
        urgency: "moderate",
        reason: "Window open while defaults stay chat-first",
      },
      strategicWarnings: [
        "Feature creep destroys signal→condition fidelity",
        "Validate distribution via external-facing proof milestones early",
      ],
      blueprintSeedInstructions:
        "Phases hinge on externally verifiable milestones; disallow inward-only checklist theater.",
      executionImplication: "Every layer should increase signal fidelity and proof culture density.",
    },
    missingFields: [],
    warnings: ["AI reality intelligence unavailable — deterministic fallback"],
    forbiddenActionRequested: false,
  };
};

fallbacks.set("fallback.reality_intelligence", realityIntelFallbackFn);
fallbacks.set("reality_intelligence_deterministic", realityIntelFallbackFn);

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

fallbacks.set("fallback.blueprint_health", (ctx, sv) => ({
  outputType: "blueprint_health",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "LOW",
  data: {
    healthScore: 0.65,
    gapsDetected: [],
    proposalsGenerated: [],
    agentAssessment: `Deterministic health snapshot for ${String(ctx["goal"] ?? "your goal").slice(0, 120)}.`,
    confidenceTier: "LOW",
  },
  missingFields: [],
  warnings: ["AI health analysis unavailable — deterministic fallback"],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.blueprint_interpretation", (ctx, sv) => ({
  outputType: "blueprint_interpretation",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "LOW",
  data: {
    interpretation: `You are working toward: ${String(ctx["goal"] ?? "your goal").slice(0, 400)}`,
    keyInsights: ["Focus on the active phase", "Complete orders to move signals"],
    currentFocus: "Finish your current active order",
    nextMilestone: "Complete the active phase requirements",
    riskFlags: [],
  },
  missingFields: [],
  warnings: ["AI interpretation unavailable — deterministic fallback"],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.psychology_identity", (ctx, sv) => ({
  outputType: "identity_update",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "MEDIUM",
  data: {
    identityStage: "DEVELOPING",
    confidenceDelta: 0.03,
    purposeAlignment: 0.55,
    keyInsight: "Execution continuity is forming a stable operational identity.",
    milestoneProximity: false,
    title: String(ctx["rewardType"] ?? "Milestone").slice(0, 60),
    message: "Phase execution complete — execution continuity maintained.",
    evidenceSummary: String(ctx["evidenceSummary"] ?? "Sustained execution evidence"),
  },
  missingFields: [],
  warnings: ["Psychology fallback — deterministic copy"],
  forbiddenActionRequested: false,
}));

fallbacks.set("fallback.execution_help", (ctx, sv) => ({
  outputType: "execution_help",
  contractVersion: "1.0",
  stateVersion: sv,
  confidence: "LOW",
  data: {
    steps: [
      "Clarify the smallest completable slice of this order.",
      "Gather any tools or references you need.",
      "Execute for a focused block of time.",
      "Capture proof of what changed.",
    ],
    toolList: ["Notes app", "Timer"],
    exampleOutput: `Completed deliverable for: ${String(ctx["orderTitle"] ?? "this order").slice(0, 80)}`,
    tip: "If blocked for 10+ minutes, document the blocker and submit feedback anyway.",
  },
  missingFields: [],
  warnings: ["AI execution help unavailable — deterministic steps used"],
  forbiddenActionRequested: false,
}));

export function hasFallbackKey(key: string): boolean {
  return fallbacks.has(key);
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
