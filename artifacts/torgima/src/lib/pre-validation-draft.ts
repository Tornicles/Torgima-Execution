export type PreValidationQuickContext = {
  domain: string;
  primaryFocus: string;
  targetAudience: string;
  experienceLevel: string;
};

export type WeeklyCommitmentKey = "LIGHT" | "MODERATE" | "HIGH" | "INTENSIVE";
export type PacingKey = "LIGHT" | "FOCUSED" | "INTENSE" | "AGGRESSIVE";

export type PreValidationDraft = {
  goal: string;
  purpose: string;
  quickContext: PreValidationQuickContext;
  /** Legacy numeric days — derived from start/end when set */
  timeframeDays: number;
  commitment: string;
  weeklyCommitment: WeeklyCommitmentKey;
  countryName: string;
  countryCode?: string;
  locationCity: string;
  currentSituation: string;
  currentStage: string;
  resourcesAvailable: string;
  environmentDescription: string;
  environmentTags: string[];
  startDate: string;
  endDate: string;
  pacing: PacingKey;
  currentContext: string;
  step: 1 | 2 | 3 | 4;
};

export const PRE_VALIDATION_DRAFT_KEY = "torgima_pre_validation_draft_v1";

function defaultEndDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export const DEFAULT_PRE_VALIDATION_DRAFT: PreValidationDraft = {
  goal: "",
  purpose: "",
  quickContext: {
    domain: "",
    primaryFocus: "",
    targetAudience: "",
    experienceLevel: "",
  },
  timeframeDays: 365,
  commitment: "MODERATE",
  weeklyCommitment: "MODERATE",
  countryName: "",
  locationCity: "",
  currentSituation: "",
  currentStage: "",
  resourcesAvailable: "",
  environmentDescription: "",
  environmentTags: [],
  startDate: new Date().toISOString().slice(0, 10),
  endDate: defaultEndDate(),
  pacing: "FOCUSED",
  currentContext: "",
  step: 1,
};

export function loadPreValidationDraft(): PreValidationDraft {
  if (typeof localStorage === "undefined") return { ...DEFAULT_PRE_VALIDATION_DRAFT };
  try {
    const raw = localStorage.getItem(PRE_VALIDATION_DRAFT_KEY);
    if (!raw) return { ...DEFAULT_PRE_VALIDATION_DRAFT };
    const parsed = JSON.parse(raw) as Partial<PreValidationDraft>;
    return {
      ...DEFAULT_PRE_VALIDATION_DRAFT,
      ...parsed,
      quickContext: {
        ...DEFAULT_PRE_VALIDATION_DRAFT.quickContext,
        ...parsed.quickContext,
      },
    };
  } catch {
    return { ...DEFAULT_PRE_VALIDATION_DRAFT };
  }
}

export function savePreValidationDraft(draft: PreValidationDraft): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PRE_VALIDATION_DRAFT_KEY, JSON.stringify(draft));
}

export function computeDurationMonths(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (30 * 24 * 3600 * 1000)));
}

export function computeDurationDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 90;
  return Math.max(30, Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000)));
}

export function formatDisplayDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function weeklyCommitmentLabel(key: WeeklyCommitmentKey): string {
  const map: Record<WeeklyCommitmentKey, string> = {
    LIGHT: "5–10 hrs (Light)",
    MODERATE: "10–20 hrs (Moderate)",
    HIGH: "20–30 hrs (High)",
    INTENSIVE: "30+ hrs (Intensive)",
  };
  return map[key];
}

export function pacingDisplayLabel(pacing: PacingKey): string {
  const labels: Record<PacingKey, string> = {
    LIGHT: "Light",
    FOCUSED: "Focused",
    INTENSE: "Intense",
    AGGRESSIVE: "Aggressive",
  };
  return labels[pacing];
}

export function pacingFullLabel(pacing: PacingKey): string {
  const subs: Record<PacingKey, string> = {
    LIGHT: "Steady",
    FOCUSED: "Balanced",
    INTENSE: "Fast",
    AGGRESSIVE: "Maximum",
  };
  return `${pacingDisplayLabel(pacing)} (${subs[pacing]})`;
}

export function weeklyCommitmentContextLabel(key: WeeklyCommitmentKey): string {
  const map: Record<WeeklyCommitmentKey, string> = {
    LIGHT: "Light (5–10 hrs/week)",
    MODERATE: "Moderate (10–20 hrs/week)",
    HIGH: "High (20+ hrs/week)",
    INTENSIVE: "Intensive (30+ hrs/week)",
  };
  return map[key];
}

export function weeklyCommitmentPerWeek(key: WeeklyCommitmentKey): string {
  const map: Record<WeeklyCommitmentKey, string> = {
    LIGHT: "5–10 hrs per week",
    MODERATE: "10–20 hrs per week",
    HIGH: "20–30 hrs per week",
    INTENSIVE: "30+ hrs per week",
  };
  return map[key];
}

export function keyChallengeFromDraft(draft: PreValidationDraft): string {
  if (draft.environmentDescription.trim()) {
    const line = draft.environmentDescription.trim().split("\n")[0];
    return line.length > 120 ? `${line.slice(0, 117)}…` : line;
  }
  if (draft.environmentTags.length > 0) return draft.environmentTags.join(", ");
  return "—";
}

export function buildSummaryOverviewBullets(draft: PreValidationDraft): string[] {
  const domain = draft.quickContext.domain || "your domain";
  const audience = draft.quickContext.targetAudience || "your audience";
  const months = computeDurationMonths(draft.startDate, draft.endDate);
  const durationWord = months === 1 ? "1-month" : `${months}-month`;
  const pacingWord = pacingDisplayLabel(draft.pacing).toLowerCase();
  const weekly = weeklyCommitmentContextLabel(draft.weeklyCommitment);
  const stage = draft.currentStage || "your current stage";
  const resources = draft.resourcesAvailable || "your available resources";

  return [
    `You are building a ${domain} solution for ${audience}.`,
    `You have a ${durationWord} ${pacingWord} timeline with a ${weekly.split("(")[0].trim().toLowerCase()} commitment level.`,
    `You're currently in ${stage.toLowerCase()} with ${resources}.`,
    "You want to create a real solution that drives results.",
  ];
}

export function commitmentFromWeekly(key: WeeklyCommitmentKey): string {
  return key;
}

export function seedErectorOnboardingFromDraft(draft: PreValidationDraft): void {
  if (typeof sessionStorage === "undefined") return;
  const payload = {
    step: "raw_goal" as const,
    rawGoal: draft.goal.trim(),
    goalOptions: [],
    selectedGoal: "",
    rawPurpose: draft.purpose.trim(),
    purposeOptions: [],
    selectedPurpose: "",
  };
  sessionStorage.setItem("torgima_erector_onboarding_v1", JSON.stringify(payload));
}
