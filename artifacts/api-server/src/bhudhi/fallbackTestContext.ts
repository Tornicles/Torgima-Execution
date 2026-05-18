import type { BhudhiTriggerType } from "../types/bhudhi.js";

/** Minimal facts for deterministic fallback schema validation in tests. */
export function fallbackTestContext(triggerType: BhudhiTriggerType | string): Record<string, unknown> {
  const base = {
    rawGoal: "Launch a B2B SaaS product with 50 paying customers in 6 months",
    goal: "Launch a B2B SaaS product with 50 paying customers in 6 months",
    purpose: "Revenue growth",
    timeframe: "6 months",
    commitmentLevel: "HIGH",
    stateVersion: 0,
    condition: "stability",
    planCount: 2,
    domainHint: "software",
    daysInactive: 3,
    bestStreak: 5,
    commandOrderMode: false,
    actionContext: "Ship onboarding flow",
    taskTitle: "Ship onboarding flow",
    timeEstimateMinutes: 45,
    feedbackText: "Blocked on API integration",
    orderTitle: "Complete integration",
    lessonTitle: "Execution fundamentals",
    evidenceNotes: "Completed MVP demo",
    failureDescription: "Missed weekly proof deadline",
    goalText: "Launch a B2B SaaS product",
    marketContext: "Crowded B2B tools market",
    userCapacity: "solo founder, 10h/week",
  };

  switch (triggerType) {
    case "TASK_DRAFTING":
      return { ...base, commandOrderMode: true };
    case "FEEDBACK_CLASSIFICATION":
      return { ...base, feedbackText: base.feedbackText };
    case "REALITY_INTELLIGENCE":
    case "EIS_INDUSTRY_RESEARCH":
      return {
        ...base,
        goalText: base.goalText,
        marketContext: base.marketContext,
        userCapacity: base.userCapacity,
      };
    default:
      return base;
  }
}
