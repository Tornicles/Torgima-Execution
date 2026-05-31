import { apiFetch } from "@/config/api";
import {
  computeDurationDays,
  type PreValidationDraft,
  type WeeklyCommitmentKey,
} from "@/lib/pre-validation-draft";
import { postValidationRun } from "@/lib/validation-run";

function weeklyToApiCommitment(key: WeeklyCommitmentKey): "low" | "medium" | "high" | "full" {
  if (key === "LIGHT") return "low";
  if (key === "HIGH") return "high";
  if (key === "INTENSIVE") return "full";
  return "medium";
}

function weeklyToSpecCommitment(key: WeeklyCommitmentKey): "LOW" | "MEDIUM" | "HIGH" | "INTENSE" {
  if (key === "LIGHT") return "LOW";
  if (key === "HIGH") return "HIGH";
  if (key === "INTENSIVE") return "INTENSE";
  return "MEDIUM";
}

function pacingToApi(pacing: PreValidationDraft["pacing"]): "focused" | "aggressive" | "relaxed" {
  if (pacing === "AGGRESSIVE" || pacing === "INTENSE") return "aggressive";
  if (pacing === "LIGHT") return "relaxed";
  return "focused";
}

export function buildOnboardingGoalBody(draft: PreValidationDraft, idempotencyKey: string) {
  const timeframeDays = computeDurationDays(draft.startDate, draft.endDate);
  const domain =
    draft.quickContext.domain.trim() ||
    draft.currentStage ||
    "Other";

  return {
    goal: draft.goal.trim(),
    purpose: draft.purpose.trim(),
    location: draft.countryName.trim(),
    currentSituation: draft.currentSituation.trim(),
    domain,
    targetAudience: draft.quickContext.targetAudience.trim(),
    currentStage: draft.currentStage.trim(),
    budget: draft.resourcesAvailable.trim(),
    currentContext: (draft.currentContext || draft.environmentDescription).trim(),
    timeframeStart: draft.startDate,
    timeframeEnd: draft.endDate,
    timeframeDays,
    timeframe: String(timeframeDays),
    commitmentLevel: weeklyToSpecCommitment(draft.weeklyCommitment),
    pacing: pacingToApi(draft.pacing),
    idempotencyKey,
    industry: draft.quickContext.domain,
    primaryFocus: draft.quickContext.primaryFocus,
    experienceLevel: draft.quickContext.experienceLevel,
  };
}

export function buildValidationRunBody(draft: PreValidationDraft, blueprintId: string) {
  const days = computeDurationDays(draft.startDate, draft.endDate);
  return {
    blueprintId,
    rawGoal: draft.goal.trim(),
    purpose: draft.purpose.trim(),
    goal: draft.goal.trim(),
    location: { country: draft.countryName.trim(), city: draft.locationCity.trim() || undefined },
    locationCountry: draft.countryName.trim(),
    customTimeframeDays: days,
    timeframe: `${days} days`,
    commitmentLevel: weeklyToApiCommitment(draft.weeklyCommitment),
    businessModel: draft.quickContext.domain.trim() || "Other",
    businessType: "online" as const,
    domainHint: draft.quickContext.domain.trim() || undefined,
    currentContext: (draft.currentContext || draft.environmentDescription).trim(),
    targetCustomer: draft.quickContext.targetAudience.trim() || draft.goal.trim().slice(0, 120),
    idempotencyKey: `onboarding-run:${blueprintId}`,
  };
}

function extractBlueprintId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const inner =
    root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
  const id = inner.blueprintId ?? inner.blueprint_id ?? inner.id;
  return id != null ? String(id) : null;
}

export async function postOnboardingGoal(
  draft: PreValidationDraft,
  idempotencyKey: string,
): Promise<{ ok: true; blueprintId: string } | { ok: false; message: string }> {
  const res = await apiFetch("/api/onboarding/goal", {
    method: "POST",
    body: JSON.stringify(buildOnboardingGoalBody(draft, idempotencyKey)),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = (data ?? {}) as Record<string, unknown>;
    const nested = err.error as { message?: string } | undefined;
    return {
      ok: false,
      message: String(err.message ?? nested?.message ?? `Could not save your direction (${res.status})`),
    };
  }
  const blueprintId = extractBlueprintId(data);
  if (!blueprintId) {
    return { ok: false, message: "Blueprint was created but no id was returned. Please retry." };
  }
  return { ok: true, blueprintId };
}

export async function runOnboardingValidation(
  draft: PreValidationDraft,
  blueprintId: string,
): Promise<{ ok: true; validationId: string } | { ok: false; message: string }> {
  const result = await postValidationRun(buildValidationRunBody(draft, blueprintId));
  if (!result.ok || !result.validationId) {
    return {
      ok: false,
      message: result.errorMessage ?? "Validation could not be started. Please retry.",
    };
  }
  return { ok: true, validationId: result.validationId };
}

export async function fetchValidationStatus(
  validationId: string,
): Promise<{ status: string; progress: number }> {
  const res = await apiFetch(`/api/v1/validations/${validationId}/status`);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    return { status: "running", progress: 0 };
  }
  if (!res.ok) return { status: "running", progress: 0 };
  const root = data as Record<string, unknown>;
  const inner =
    root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
  const status = String(inner.status ?? "running").toLowerCase();
  const progress = Number(inner.progress ?? 0);
  return { status, progress: Number.isFinite(progress) ? progress : 0 };
}

export function isValidationComplete(status: string): boolean {
  return (
    status === "complete" ||
    status === "completed" ||
    status === "validated" ||
    status === "finalized"
  );
}
