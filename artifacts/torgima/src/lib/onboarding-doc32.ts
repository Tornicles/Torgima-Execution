import type { PreValidationDraft } from "@/lib/pre-validation-draft";
import { computeDurationDays } from "@/lib/pre-validation-draft";
import { buildOnboardingGoalBody } from "@/lib/onboarding-api";

export type OnboardingWizardStatus =
  | "EMPTY"
  | "DRAFTING"
  | "STRUCTURING"
  | "NEEDS_CLARIFICATION"
  | "INVALID"
  | "VALID_DRAFT"
  | "ACTIVATING"
  | "ACTIVE"
  | "BHUDHI_UNAVAILABLE";

export type StructuredGoalDraft = {
  cleanedGoal: string;
  purpose: string;
  timeframe: string;
  commitmentLevel: string;
  currentContext: string;
  successSignals: string[];
  blockers: string[];
  domainHints: string[];
  missingRequiredFields: string[];
  ambiguityFlags: string[];
  validationVerdict: "VALID" | "NEEDS_CLARIFICATION" | "INVALID";
  suggestedClarifyingQuestion?: string | null;
};

export const CLARIFICATION_FIELD_LABELS: Record<string, string> = {
  goal: "What do you want to achieve in the next 90 days?",
  purpose: "Why does this matter to you right now?",
  timeframe: "What is your target timeframe or season for this?",
  commitment: "How much time can you commit each week?",
  commitmentLevel: "How much time can you commit each week?",
  context: "What is your current reality — constraints, resources, starting point?",
  currentContext: "What is your current reality — constraints, resources, starting point?",
};

export function parseStructuredGoalPayload(data: unknown): StructuredGoalDraft | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const inner =
    root.structured && typeof root.structured === "object"
      ? (root.structured as Record<string, unknown>)
      : root;
  const cleanedGoal = String(inner.cleanedGoal ?? inner.cleaned_goal ?? "").trim();
  if (!cleanedGoal && !inner.validationVerdict) return null;
  return {
    cleanedGoal: cleanedGoal || String(inner.rawGoal ?? ""),
    purpose: String(inner.purpose ?? ""),
    timeframe: String(inner.timeframe ?? ""),
    commitmentLevel: String(inner.commitmentLevel ?? inner.commitment_level ?? "medium"),
    currentContext: String(inner.currentContext ?? inner.current_context ?? ""),
    successSignals: Array.isArray(inner.successSignals)
      ? inner.successSignals.map(String)
      : [],
    blockers: Array.isArray(inner.blockers) ? inner.blockers.map(String) : [],
    domainHints: Array.isArray(inner.domainHints) ? inner.domainHints.map(String) : [],
    missingRequiredFields: Array.isArray(inner.missingRequiredFields)
      ? inner.missingRequiredFields.map(String)
      : [],
    ambiguityFlags: Array.isArray(inner.ambiguityFlags)
      ? inner.ambiguityFlags.map(String)
      : [],
    validationVerdict:
      (inner.validationVerdict as StructuredGoalDraft["validationVerdict"]) ??
      (Array.isArray(inner.missingRequiredFields) &&
      (inner.missingRequiredFields as unknown[]).length > 0
        ? "NEEDS_CLARIFICATION"
        : "VALID"),
    suggestedClarifyingQuestion:
      (inner.suggestedClarifyingQuestion as string | null | undefined) ?? null,
  };
}

export function buildStructureGoalBody(draft: PreValidationDraft, idempotencyKey: string) {
  const days = computeDurationDays(draft.startDate, draft.endDate);
  return {
    rawGoal: draft.goal.trim(),
    purpose: draft.purpose.trim(),
    timeframe: `${days} days`,
    commitmentLevel: draft.weeklyCommitment.toLowerCase(),
    currentContext: (draft.currentContext || draft.environmentDescription || draft.currentSituation).trim(),
    successSignal: draft.quickContext.primaryFocus.trim() || undefined,
    knownBlockers: draft.environmentTags.join(", ") || undefined,
    domainHints: draft.quickContext.domain ? [draft.quickContext.domain] : undefined,
    idempotencyKey,
  };
}

export function applyStructuredDraftToPreValidation(
  draft: PreValidationDraft,
  structured: StructuredGoalDraft,
): PreValidationDraft {
  return {
    ...draft,
    goal: structured.cleanedGoal || draft.goal,
    purpose: structured.purpose || draft.purpose,
    currentContext: structured.currentContext || draft.currentContext,
    commitment: structured.commitmentLevel.toUpperCase() || draft.commitment,
  };
}

export function buildGoalSubmitBody(draft: PreValidationDraft, idempotencyKey: string) {
  return buildOnboardingGoalBody(draft, idempotencyKey);
}

export const TIER_CARD_TAGLINES: Record<"starter" | "growth" | "ultimate", string> = {
  starter: "Clarity and guided daily execution",
  growth: "Structured execution with signal adaptation",
  ultimate: "Predictive control and strategic optimization",
};

/** DOC 32 — customer-facing verdict labels (never PROCEED/ADJUST/PIVOT). */
export const CUSTOMER_VERDICT_LABELS: Record<string, string> = {
  proceed: "Proceed",
  adjust: "Needs Adjustment",
  pivot: "Change Direction",
  PROCEED: "Proceed",
  ADJUST: "Needs Adjustment",
  PIVOT: "Change Direction",
};

/** DOC 32 — path card titles in customer language. */
export const PATH_DIRECTION_LABELS = {
  current: "Current Direction",
  adjusted: "Refined Direction",
  alternative: "Alternative Direction",
} as const;

export type LimitedDashboardVariant =
  | "post_free_validation"
  | "intake_in_progress"
  | "direct_signup"
  | "free_validation_complete"
  | "intake_not_started";

/** @deprecated use server `limited_variant` when available */
export function resolveLimitedDashboardVariant(input: {
  validationSummary?: string | null;
  mode?: string;
  intakeInProgress?: boolean;
}): LimitedDashboardVariant {
  if (input.validationSummary?.trim() || input.mode === "review") {
    return "post_free_validation";
  }
  if (input.intakeInProgress) {
    return "intake_in_progress";
  }
  return "direct_signup";
}

export function estimateIntakeMinutesRemaining(sectionsCompleted: number): number {
  const remaining = Math.max(0, 8 - sectionsCompleted);
  return Math.max(2, remaining * 2);
}

export const LAUNCH_WHAT_HAPPENS_NEXT = [
  "Tomorrow morning, you will see your first specific task.",
  "As you complete tasks, your project health score will update.",
  "The system adapts to your execution rhythm over time.",
] as const;
