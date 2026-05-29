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
