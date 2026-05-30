import type { AlignedIntakeForm } from "@/components/onboarding/AlignedGoalIntake";
import type { CommitmentKey } from "@/components/onboarding/erector-intake-types";
import type { CountrySelection } from "@/lib/countries";

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
  country: CountrySelection | null;
  domain: string;
  commitment: CommitmentKey;
  currentContext: string;
  timeframeDays: number;
  pace: string;
};

export type OnboardingGoalFlatPayload = {
  goal: string;
  purpose: string;
  timeframe: string;
  location: string;
  commitmentLevel: "low" | "medium" | "high" | "full";
  domain: string;
  currentContext?: string;
  idempotencyKey: string;
};

export function normalizeTimeframe(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.max(1, Math.round(value)));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const daysSuffix = trimmed.match(/^(\d+)\s*days?$/i);
    if (daysSuffix?.[1]) return daysSuffix[1];
    if (/^\d+$/.test(trimmed)) return trimmed;
    return trimmed;
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.duration_days === "number") return String(o.duration_days);
    if (typeof o.durationDays === "number") return String(o.durationDays);
  }
  return "";
}

export function normalizeCommitment(value: unknown): "low" | "medium" | "high" | "full" {
  const c = String(value ?? "").toLowerCase();
  if (c === "low") return "low";
  if (c === "medium" || c === "moderate") return "medium";
  if (c === "high") return "high";
  if (c === "full" || c === "intense" || c === "full-time") return "full";
  return "medium";
}

export function normalizeDomain(value: string): string {
  return value.trim();
}

/** Flat POST /api/onboarding/goal body (backend-compatible). */
export function buildOnboardingGoalFlatPayload(
  state: {
    selectedGoal: string;
    selectedPurpose: string;
    context: ErectorContextForm;
  },
  options: { idempotencyKey: string },
): OnboardingGoalFlatPayload {
  const domain = normalizeDomain(state.context.domain);
  const payload: OnboardingGoalFlatPayload = {
    goal: state.selectedGoal.trim(),
    purpose: state.selectedPurpose.trim(),
    timeframe: normalizeTimeframe(state.context.timeframeDays),
    location: state.context.country?.countryName?.trim() ?? "",
    commitmentLevel: normalizeCommitment(state.context.commitment),
    domain,
    idempotencyKey: options.idempotencyKey,
  };
  const ctx = state.context.currentContext.trim();
  if (ctx) payload.currentContext = ctx;
  return payload;
}

/** @deprecated Use buildOnboardingGoalFlatPayload for POST /api/onboarding/goal */
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
      location: state.context.country?.countryName?.trim() ?? "",
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
  if (!context.country?.countryName?.trim()) errors.country = "Select a country from the list.";
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
