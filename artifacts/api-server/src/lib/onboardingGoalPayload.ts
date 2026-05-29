import { z } from "zod/v4";

const commitmentEnum = z.enum(["low", "medium", "high", "full"]);

export type ParsedOnboardingGoal = {
  rawGoal: string;
  purpose: string;
  timeframe: string;
  timeframeDays: number | null;
  commitmentLevel: z.infer<typeof commitmentEnum>;
  domain?: string;
  currentContext?: string;
  successSignal?: string;
  knownBlockers?: string;
  locationContext?: string;
  realityContext?: string;
  selectedBlueprintTier: "starter" | "growth" | "ultimate";
  selectedBlueprintMode: "individual" | "team";
  idempotencyKey: string;
  domainHints?: string[];
  tier?: "starter" | "growth" | "ultimate";
  mode?: "individual" | "team";
};

function parseTimeframeDays(timeframe: string): number | null {
  const directDays = timeframe.match(/(\d+)\s*(day|days)/i);
  if (directDays?.[1]) return Number(directDays[1]);
  const weeks = timeframe.match(/(\d+)\s*(week|weeks)/i);
  if (weeks?.[1]) return Number(weeks[1]) * 7;
  const months = timeframe.match(/(\d+)\s*(month|months)/i);
  if (months?.[1]) return Number(months[1]) * 30;
  const years = timeframe.match(/(\d+)\s*(year|years)/i);
  if (years?.[1]) return Number(years[1]) * 365;
  return null;
}

function daysBetweenIso(start: string, end: string): number | null {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (24 * 3600 * 1000)));
}

function formatTimeframeLabel(days: number, pace?: string): string {
  const paceSuffix = pace?.trim() ? ` (${pace.trim()} pace)` : "";
  if (days <= 45) return `${days} days${paceSuffix}`;
  if (days <= 120) return `${days} days${paceSuffix}`;
  if (days <= 200) return `${Math.round(days / 30)} months${paceSuffix}`;
  return `${Math.round(days / 365)} years${paceSuffix}`;
}

function mapPaceToCommitment(pace: string | undefined, commitment: string | undefined): z.infer<typeof commitmentEnum> {
  const c = (commitment ?? "").toLowerCase();
  if (c === "low" || c === "medium" || c === "high" || c === "full") return c;
  const p = (pace ?? "").toLowerCase();
  if (p.includes("slow") || p === "low") return "low";
  if (p.includes("intense") || p.includes("full")) return "full";
  if (p.includes("fast") || p === "high") return "high";
  return "medium";
}

const nestedSchema = z
  .object({
    goal: z.string(),
    purpose: z.string(),
    timeframe: z.object({
      start: z.string(),
      end: z.string(),
      duration_days: z.number().optional(),
      pace: z.string().optional(),
    }),
    context: z.object({
      location: z.string(),
      commitment: z.string(),
      domain: z.string(),
    }),
    idempotencyKey: z.string().min(1),
    selectedBlueprintTier: z.enum(["starter", "growth", "ultimate"]).optional(),
    selectedBlueprintMode: z.enum(["individual", "team"]).optional(),
    tier: z.enum(["starter", "growth", "ultimate"]).optional(),
    mode: z.enum(["individual", "team"]).optional(),
    currentContext: z.string().optional(),
    successSignal: z.string().optional(),
    knownBlockers: z.string().optional(),
    realityContext: z.string().optional(),
  })
  .strict();

const flatSchema = z
  .object({
    rawGoal: z.string().optional(),
    goal: z.string().optional(),
    purpose: z.string(),
    timeframe: z.string(),
    customTimeframeDays: z.number().optional(),
    commitmentLevel: commitmentEnum,
    domain: z.string().optional(),
    currentContext: z.string().optional(),
    successSignal: z.string().optional(),
    knownBlockers: z.string().optional(),
    locationContext: z.string().optional(),
    locationCountry: z.string().optional(),
    realityContext: z.string().optional(),
    selectedBlueprintTier: z.enum(["starter", "growth", "ultimate"]).optional(),
    selectedBlueprintMode: z.enum(["individual", "team"]).optional(),
    tier: z.enum(["starter", "growth", "ultimate"]).optional(),
    mode: z.enum(["individual", "team"]).optional(),
    idempotencyKey: z.string().min(1),
    domainHints: z.array(z.string()).optional(),
  })
  .strict();

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_root";
    out[key] = [...(out[key] ?? []), issue.message];
  }
  return out;
}

export function parseOnboardingGoalBody(body: unknown):
  | { ok: true; data: ParsedOnboardingGoal }
  | { ok: false; fieldErrors: Record<string, string[]> } {
  const nested = nestedSchema.safeParse(body);
  if (nested.success) {
    const d = nested.data;
    const rawGoal = d.goal.trim();
    const purpose = d.purpose.trim();
    const location = d.context.location.trim();
    if (rawGoal.length < 5) {
      return { ok: false, fieldErrors: { goal: ["Goal must be at least 5 characters"] } };
    }
    if (purpose.length < 5) {
      return { ok: false, fieldErrors: { purpose: ["Purpose must be at least 5 characters"] } };
    }
    const duration =
      d.timeframe.duration_days ?? daysBetweenIso(d.timeframe.start, d.timeframe.end) ?? null;
    const timeframe =
      duration != null ?
        formatTimeframeLabel(duration, d.timeframe.pace)
      : `${d.timeframe.start} to ${d.timeframe.end}`;
    const commitmentLevel = mapPaceToCommitment(d.timeframe.pace, d.context.commitment);
    return {
      ok: true,
      data: {
        rawGoal,
        purpose,
        timeframe,
        timeframeDays: duration ?? parseTimeframeDays(timeframe),
        commitmentLevel,
        domain: d.context.domain.trim() || undefined,
        locationContext: location || undefined,
        currentContext: d.currentContext,
        successSignal: d.successSignal,
        knownBlockers: d.knownBlockers,
        realityContext: d.realityContext,
        selectedBlueprintTier: d.selectedBlueprintTier ?? d.tier ?? "starter",
        selectedBlueprintMode: d.selectedBlueprintMode ?? d.mode ?? "individual",
        idempotencyKey: d.idempotencyKey,
        tier: d.tier,
        mode: d.mode,
      },
    };
  }

  const flat = flatSchema.safeParse(body);
  if (!flat.success) {
    return { ok: false, fieldErrors: zodFieldErrors(flat.error) };
  }

  const d = flat.data;
  const rawGoal = (d.rawGoal ?? d.goal ?? "").trim();
  const purpose = d.purpose.trim();
  if (rawGoal.length < 5) {
    return { ok: false, fieldErrors: { rawGoal: ["Goal must be at least 5 characters"] } };
  }
  if (purpose.length < 5) {
    return { ok: false, fieldErrors: { purpose: ["Purpose must be at least 5 characters"] } };
  }

  let timeframe = d.timeframe.trim();
  if (d.customTimeframeDays && /^\d+d$/.test(timeframe)) {
    timeframe = `${d.customTimeframeDays} days`;
  } else if (/^\d+d$/.test(timeframe)) {
    const n = Number(timeframe.replace(/d$/i, ""));
    timeframe = `${n} days`;
  }

  return {
    ok: true,
    data: {
      rawGoal,
      purpose,
      timeframe,
      timeframeDays: d.customTimeframeDays ?? parseTimeframeDays(timeframe),
      commitmentLevel: d.commitmentLevel,
      domain: d.domain,
      currentContext: d.currentContext,
      successSignal: d.successSignal,
      knownBlockers: d.knownBlockers,
      locationContext: d.locationContext ?? d.locationCountry,
      realityContext: d.realityContext,
      selectedBlueprintTier: d.selectedBlueprintTier ?? d.tier ?? "starter",
      selectedBlueprintMode: d.selectedBlueprintMode ?? d.mode ?? "individual",
      idempotencyKey: d.idempotencyKey,
      domainHints: d.domainHints,
      tier: d.tier,
      mode: d.mode,
    },
  };
}
