import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { zodFieldErrors } from "./onboardingGoalPayload.js";

const commitmentEnum = z.enum(["low", "medium", "high", "full"]);

export type FlatOnboardingGoal = {
  goal: string;
  purpose: string;
  timeframe: string;
  location: string;
  commitmentLevel: z.infer<typeof commitmentEnum>;
  domain: string;
  currentContext?: string;
};

export type AdaptedOnboardingGoal = {
  flat: FlatOnboardingGoal;
  idempotencyKey: string;
  rawGoal?: string;
  rawPurpose?: string;
  projectName?: string;
  selectedBlueprintTier: "starter" | "growth" | "ultimate";
  selectedBlueprintMode: "individual" | "team";
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

export function normalizeCommitment(value: unknown): z.infer<typeof commitmentEnum> {
  const c = String(value ?? "").toLowerCase();
  if (c === "low") return "low";
  if (c === "medium" || c === "moderate") return "medium";
  if (c === "high") return "high";
  if (c === "full" || c === "intense" || c === "full-time") return "full";
  return "medium";
}

export function normalizeDomain(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseTimeframeDays(timeframe: string): number | null {
  const n = Number(timeframe);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  const directDays = timeframe.match(/(\d+)\s*(day|days)/i);
  if (directDays?.[1]) return Number(directDays[1]);
  return null;
}

const flatOnboardingSchema = z
  .object({
    goal: z.string().min(5),
    purpose: z.string().min(5),
    timeframe: z.string().min(1),
    location: z.string().min(1),
    commitmentLevel: commitmentEnum,
    domain: z.string().min(1),
    currentContext: z.string().optional(),
  })
  .strict();

/** Accept legacy flat or nested UI payloads; normalize to backend flat shape. */
export function adaptOnboardingGoalRequest(body: unknown):
  | { ok: true; data: AdaptedOnboardingGoal }
  | { ok: false; fieldErrors: Record<string, string[]> } {
  const b = (body ?? {}) as Record<string, unknown>;
  const context =
    b.context && typeof b.context === "object" ? (b.context as Record<string, unknown>) : null;

  const goal =
    (typeof b.goal === "string" ? b.goal : typeof b.selectedGoal === "string" ? b.selectedGoal : "")
      .trim();
  const purpose =
    (
      typeof b.purpose === "string"
        ? b.purpose
        : typeof b.selectedPurpose === "string"
          ? b.selectedPurpose
          : ""
    ).trim();

  const timeframe = normalizeTimeframe(
    b.timeframe ??
      b.timeframeDays ??
      (context ? undefined : b.timeframeDays) ??
      context?.timeframe,
  );

  const location =
    (typeof b.location === "string" ? b.location : "")
      .trim() ||
    (typeof b.locationCountry === "string" ? b.locationCountry : "").trim() ||
    (typeof b.locationContext === "string" ? b.locationContext : "").trim() ||
    (context && typeof context.location === "string" ? context.location : "").trim();

  const commitmentLevel = normalizeCommitment(
    b.commitmentLevel ?? context?.commitment ?? b.commitment,
  );

  const domain =
    normalizeDomain(b.domain) ||
    (context && typeof context.domain === "string" ? normalizeDomain(context.domain) : "");

  const currentContext =
    (typeof b.currentContext === "string" ? b.currentContext : "").trim() ||
    (context && typeof context.current_context === "string"
      ? String(context.current_context).trim()
      : "");

  const fieldErrors: Record<string, string[]> = {};
  if (!goal) fieldErrors.goal = ["goal is required"];
  if (!purpose) fieldErrors.purpose = ["purpose is required"];
  if (!timeframe) fieldErrors.timeframe = ["timeframe is required"];
  if (!location) fieldErrors.location = ["location is required"];
  if (!domain) fieldErrors.domain = ["domain is required"];

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const flatCandidate: FlatOnboardingGoal = {
    goal,
    purpose,
    timeframe,
    location,
    commitmentLevel,
    domain,
    ...(currentContext ? { currentContext } : {}),
  };

  const validated = flatOnboardingSchema.safeParse(flatCandidate);
  if (!validated.success) {
    return { ok: false, fieldErrors: zodFieldErrors(validated.error) };
  }

  const idempotencyKey =
    typeof b.idempotencyKey === "string" && b.idempotencyKey.trim()
      ? b.idempotencyKey.trim()
      : randomUUID();

  const rawGoal =
    typeof b.rawGoal === "string" && b.rawGoal.trim() ? b.rawGoal.trim() : undefined;
  const rawPurpose =
    typeof b.rawPurpose === "string" && b.rawPurpose.trim() ? b.rawPurpose.trim() : undefined;

  const projectNameRaw =
    typeof b.projectName === "string"
      ? b.projectName
      : typeof b.project_name === "string"
        ? b.project_name
        : "";
  const projectName = projectNameRaw.trim() || undefined;

  const tierRaw = b.selectedBlueprintTier ?? b.tier;
  const modeRaw = b.selectedBlueprintMode ?? b.mode;

  return {
    ok: true,
    data: {
      flat: validated.data,
      idempotencyKey,
      rawGoal,
      rawPurpose,
      projectName,
      selectedBlueprintTier:
        tierRaw === "growth" || tierRaw === "ultimate" ? tierRaw : "starter",
      selectedBlueprintMode: modeRaw === "team" ? "team" : "individual",
    },
  };
}

export function flatToParsedGoal(adapted: AdaptedOnboardingGoal, body?: Record<string, unknown>) {
  const { flat } = adapted;
  const b = body ?? {};
  const timeframeDays =
    parseTimeframeDays(flat.timeframe) ??
    (typeof b.timeframeDays === "number" ? b.timeframeDays : null) ??
    90;
  const startRaw = typeof b.timeframeStart === "string" ? b.timeframeStart : null;
  const endRaw = typeof b.timeframeEnd === "string" ? b.timeframeEnd : null;
  return {
    rawGoal: flat.goal,
    purpose: flat.purpose,
    timeframe: `${timeframeDays} days`,
    timeframeDays,
    timeframeStart: startRaw,
    timeframeEnd: endRaw,
    commitmentLevel: flat.commitmentLevel,
    domain: flat.domain,
    currentContext: flat.currentContext,
    locationContext: flat.location,
    selectedBlueprintTier: adapted.selectedBlueprintTier,
    selectedBlueprintMode: adapted.selectedBlueprintMode,
    idempotencyKey: adapted.idempotencyKey,
    tier: adapted.selectedBlueprintTier,
    mode: adapted.selectedBlueprintMode,
    projectName: adapted.projectName,
  };
}
