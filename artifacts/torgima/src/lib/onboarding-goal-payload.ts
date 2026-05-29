import type { AlignedIntakeForm } from "@/components/onboarding/AlignedGoalIntake";
import type { CommitmentKey } from "@/components/onboarding/erector-intake-types";

function commitmentForApi(level: CommitmentKey): "low" | "medium" | "high" | "full" {
  if (level === "LOW") return "low";
  if (level === "HIGH") return "high";
  if (level === "INTENSE") return "full";
  return "medium";
}

function durationDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 90;
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (24 * 3600 * 1000)));
}

/** Canonical POST /api/onboarding/goal body (nested contract). */
export function buildOnboardingGoalPayload(
  intake: AlignedIntakeForm,
  options: {
    idempotencyKey: string;
    tier?: "starter" | "growth" | "ultimate";
    mode?: "individual" | "team";
  },
) {
  const goal = intake.rawGoal.trim();
  const purpose = intake.purpose.trim();
  const start = intake.startDate;
  const end = intake.endDate;

  return {
    goal,
    purpose,
    timeframe: {
      start,
      end,
      duration_days: durationDays(start, end),
      pace: intake.pace,
    },
    context: {
      location: intake.locationCountry.trim() || "Unknown",
      commitment: commitmentForApi(intake.commitmentLevel),
      domain: intake.businessModel.trim() || "Other",
    },
    idempotencyKey: options.idempotencyKey,
    selectedBlueprintTier: options.tier ?? "starter",
    selectedBlueprintMode: options.mode ?? "individual",
    tier: options.tier ?? "starter",
    mode: options.mode ?? "individual",
  };
}

export type ErectorContextForm = {
  location: string;
  domain: string;
  commitment: CommitmentKey;
  currentContext: string;
  timeframeDays: number;
  pace: string;
};

/** Canonical POST /api/onboarding/goal after Erector refinement (refined goal/purpose + raw copies). */
export function buildErectorValidationPayload(
  state: {
    rawGoal: string;
    selectedGoal: string;
    rawPurpose: string;
    selectedPurpose: string;
    context: ErectorContextForm;
  },
  options: {
    idempotencyKey: string;
    tier?: "starter" | "growth" | "ultimate";
    mode?: "individual" | "team";
  },
) {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + state.context.timeframeDays);

  return {
    goal: state.selectedGoal.trim(),
    purpose: state.selectedPurpose.trim(),
    rawGoal: state.rawGoal.trim(),
    rawPurpose: state.rawPurpose.trim(),
    timeframe: {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      duration_days: state.context.timeframeDays,
      pace: state.context.pace,
    },
    context: {
      location: state.context.location.trim(),
      commitment: commitmentForApi(state.context.commitment),
      domain: state.context.domain.trim() || "Other",
      current_context: state.context.currentContext.trim() || undefined,
    },
    currentContext: state.context.currentContext.trim() || undefined,
    idempotencyKey: options.idempotencyKey,
    selectedBlueprintTier: options.tier ?? "starter",
    selectedBlueprintMode: options.mode ?? "individual",
    tier: options.tier ?? "starter",
    mode: options.mode ?? "individual",
  };
}

export function validateErectorContext(context: ErectorContextForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!context.location.trim()) errors.location = "Location is required.";
  if (!context.domain.trim()) errors.domain = "Domain / business type is required.";
  if (!context.commitment) errors.commitment = "Select a commitment level.";
  if (!context.timeframeDays || context.timeframeDays < 1) errors.timeframe = "Select a timeframe.";
  return errors;
}

export function validateIntakeBeforeSubmit(intake: AlignedIntakeForm): string | null {
  if (!intake.rawGoal?.trim() || intake.rawGoal.trim().length < 5) {
    return "Enter a clear goal (at least 5 characters).";
  }
  if (!intake.purpose?.trim() || intake.purpose.trim().length < 5) {
    return "Enter your purpose (at least 5 characters).";
  }
  if (!intake.startDate || !intake.endDate) {
    return "Select a start and end date for your timeframe.";
  }
  return null;
}
