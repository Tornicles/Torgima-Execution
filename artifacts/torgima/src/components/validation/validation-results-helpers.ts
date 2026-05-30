import type { PathKey } from "./PathPanels";
import type { ValidationScreenData } from "./ValidationScreen";

export function scoreOn10(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 5;
  return v <= 10 ? v : v / 10;
}

export function parsePath(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { description: raw };
    }
  }
  return raw as Record<string, unknown>;
}

export type ValidationViewModel = {
  erector: Record<string, unknown>;
  scores: Record<string, number | undefined>;
  verdict: string;
  rawGoal: string;
  purpose: string;
  locationCountry: string;
  commitmentLevel: string;
  businessModel: string;
  realityScore: number;
  ringPct: number;
  marketScore: number;
  competitionScore: number;
  timingScore: number;
  scalabilityScore: number;
  momentumScore: number;
  localEconomyScore: number;
  competitors: Array<Record<string, unknown>>;
  industryCons: string[];
  purposeDecomposition: Record<string, unknown> | null;
  paths: { current: Record<string, unknown>; adjusted: Record<string, unknown>; alternative: Record<string, unknown> };
  blueprintId: string;
};

export function buildViewModel(data: ValidationScreenData): ValidationViewModel {
  const erector = (data.intelligence?.erector ?? data.intelligence ?? {}) as Record<string, unknown>;
  const scores = (erector.scores ?? data.scores ?? {}) as Record<string, number | undefined>;
  const verdict = String(data.verdict ?? scores.verdict ?? erector.verdict ?? "adjust").toLowerCase();

  const pathsRaw = data.paths ?? (erector.paths as ValidationScreenData["paths"]);
  const realityScore = Number(erector.realityScore ?? erector.reality_score ?? scores.realityScore ?? 0);
  const ringPct = Math.min(
    100,
    Math.max(0, Math.round(realityScore <= 10 ? realityScore * 10 : realityScore)),
  );

  return {
    erector,
    scores,
    verdict,
    rawGoal: String(erector.rawGoal ?? erector.raw_goal ?? erector.goal_final ?? ""),
    purpose: String(erector.purpose ?? erector.purpose_final ?? ""),
    locationCountry: String(erector.locationCountry ?? erector.location_country ?? "your area"),
    commitmentLevel: String(erector.commitmentLevel ?? erector.commitment_level ?? "medium"),
    businessModel: String(erector.businessModel ?? erector.business_model ?? "your business"),
    realityScore,
    ringPct,
    marketScore: scoreOn10(scores.marketScore ?? erector.market_score),
    competitionScore: scoreOn10(scores.competitionScore ?? erector.competition_score),
    timingScore: scoreOn10(scores.timingScore ?? erector.timing_score),
    scalabilityScore: scoreOn10(scores.scalabilityScore ?? erector.scalability_score),
    momentumScore: scoreOn10(scores.momentumPotential ?? erector.momentum_potential),
    localEconomyScore: scoreOn10(scores.localEconomyScore ?? erector.local_economy_score),
    competitors: extractCompetitors(erector),
    industryCons: extractIndustryCons(erector),
    purposeDecomposition: extractPurposeDecomposition(erector),
    paths: {
      current: parsePath(pathsRaw?.current ?? erector.path_current),
      adjusted: parsePath(pathsRaw?.adjusted ?? erector.path_adjusted),
      alternative: parsePath(pathsRaw?.alternative ?? erector.path_alternative),
    },
    blueprintId: String(data.blueprintId ?? erector.blueprintId ?? ""),
  };
}

function extractCompetitors(erector: Record<string, unknown>): Array<Record<string, unknown>> {
  const raw = erector.competitor_analysis ?? erector.competitorAnalysis ?? erector.competitors;
  if (Array.isArray(raw)) return raw.slice(0, 3) as Array<Record<string, unknown>>;
  if (raw && typeof raw === "object") {
    const list = (raw as { competitors?: unknown }).competitors;
    if (Array.isArray(list)) return list.slice(0, 3) as Array<Record<string, unknown>>;
  }
  return [];
}

function extractIndustryCons(erector: Record<string, unknown>): string[] {
  const raw = erector.industryCons ?? erector.industry_cons ?? erector.risks;
  if (Array.isArray(raw)) return raw.map((r) => (typeof r === "string" ? r : String((r as { text?: string }).text ?? r)));
  return [];
}

function extractPurposeDecomposition(erector: Record<string, unknown>): Record<string, unknown> | null {
  const raw = erector.purpose_decomposition ?? erector.purposeDecomposition;
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

export function headlineForVerdict(verdict: string): string {
  if (verdict === "proceed") return "Good idea. People want this. Keep going.";
  if (verdict === "pivot") return "This can work — but your current direction makes it harder.";
  if (verdict === "blocked") return "This needs some changes before it's ready to build.";
  return "Good idea. A few changes could make this stronger.";
}

export function bottomCtaSentence(verdict: string): string {
  if (verdict === "proceed") return "People want this. You understand the space. Time to start building.";
  if (verdict === "pivot") return "The idea is solid. The angle needs work. Pick a direction and start.";
  if (verdict === "blocked") return "A few things need attention first. Deal with those and this becomes real.";
  return "You are closer than you think. A small change could make this much stronger.";
}

export function ringStrokeColor(pct: number): string {
  if (pct >= 90) return "#157a33";
  if (pct >= 75) return "#1a8c3a";
  if (pct >= 60) return "#eab308";
  if (pct >= 40) return "#f97316";
  return "#dc2626";
}

export function demandLevel(marketScore: number): "HIGH" | "MEDIUM" | "LOW" {
  if (marketScore >= 7) return "HIGH";
  if (marketScore >= 4) return "MEDIUM";
  return "LOW";
}

export function plainRiskTitle(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("compet")) return "Too many people already doing this";
  if (lower.includes("time") || lower.includes("month") || lower.includes("timeline")) return "This takes longer than most people expect";
  if (lower.includes("capital") || lower.includes("money") || lower.includes("fund")) return "You may need more money than you think";
  if (lower.includes("audience") || lower.includes("customer") || lower.includes("target")) return "Your audience is not clearly defined yet";
  if (lower.includes("urgency") || lower.includes("demand")) return "People are not desperate to solve this yet";
  if (lower.includes("trust") || lower.includes("credib")) return "Building trust takes time in this area";
  if (lower.includes("regulat") || lower.includes("compliance")) return "There are rules to follow in this space";
  if (lower.includes("tech")) return "There is technical work involved";
  return text.split(/[.—]/)[0]?.trim() || "Something to plan for";
}

export function pathKeyFromChoice(index: 0 | 1 | 2): PathKey {
  if (index === 0) return "current";
  if (index === 1) return "adjusted";
  return "alternative";
}
