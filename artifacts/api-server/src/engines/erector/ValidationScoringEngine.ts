import type {
  DimensionScores,
  MatrixTier,
  RealityProfileRow,
  ScoringContext,
  TierThresholds,
} from "./types/verdict-types.js";

const CLASS_TO_SCORE: Record<number, number> = {
  0: 0,
  1: 15,
  2: 35,
  3: 55,
  4: 75,
  5: 100,
};

const BROAD_AUDIENCE = new Set(["everyone", "anyone", "all people", "the world", "everybody"]);

export function mapIntakeTierToMatrixTier(tier: string): MatrixTier {
  if (tier === "pro") return "growth";
  if (tier === "ultimate") return "ultimate";
  return "starter";
}

export function classifyArchetypeFromProfile(profile: RealityProfileRow): string {
  const blob = `${profile.structured_goal} ${profile.business_type ?? ""} ${profile.revenue_model ?? ""} ${profile.industry ?? ""}`.toLowerCase();
  if (/\b(marketplace|two-sided|exchange)\b/.test(blob)) return "marketplace_exchange";
  if (/\b(saas|subscription|software platform|b2b software)\b/.test(blob)) return "saas_platform";
  if (/\b(consult|advisory|coaching)\b/.test(blob)) return "consulting_advisory";
  if (/\b(content|media|creator|newsletter|podcast)\b/.test(blob)) return "content_media";
  if (/\b(physical product|inventory|manufacturing|retail)\b/.test(blob)) return "physical_product_inventory";
  if (/\b(course|ebook|knowledge product|information product)\b/.test(blob)) return "information_knowledge_product";
  if (/\b(community|collective|membership)\b/.test(blob)) return "collective_community";
  if (/\b(nonprofit|social enterprise|mission)\b/.test(blob)) return "social_enterprise_mission";
  if (/\b(service|agency|freelance)\b/.test(blob)) return "direct_service_delivery";
  return "subscription_recurring";
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseTimelineDays(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const lower = value.toLowerCase();
  const dayMatch = lower.match(/(\d+)\s*day/);
  if (dayMatch) return Number(dayMatch[1]);
  const weekMatch = lower.match(/(\d+)\s*week/);
  if (weekMatch) return Number(weekMatch[1]) * 7;
  const monthMatch = lower.match(/(\d+)\s*month/);
  if (monthMatch) return Number(monthMatch[1]) * 30;
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return Math.max(0, Math.ceil((parsed - Date.now()) / (1000 * 60 * 60 * 24)));
  }
  return null;
}

function impliesFullTimeWork(success30: string | null | undefined): boolean {
  if (!success30) return false;
  const lower = success30.toLowerCase();
  return /\b(full[- ]time|launch live|100 customers|50 customers|revenue|profit|mrr|arr)\b/.test(lower);
}

function hasSpecificTarget(targetWho: string | null): boolean {
  if (!targetWho?.trim()) return false;
  return !BROAD_AUDIENCE.has(targetWho.toLowerCase().trim());
}

function hasValidatedDemandSignal(
  goal: string | null,
  purpose: Record<string, unknown>,
  measurableOutcome?: string | null,
): boolean {
  const blob = `${goal ?? ""} ${measurableOutcome ?? ""} ${JSON.stringify(purpose)}`.toLowerCase();
  return /\b(asked \d+|waitlist|pre-?order|paid client|existing sales|renewal|\d+ would pay)\b/.test(blob);
}

function hasProvenExchange(
  goal: string | null,
  purpose: Record<string, unknown>,
  measurableOutcome?: string | null,
): boolean {
  const blob = `${goal ?? ""} ${measurableOutcome ?? ""} ${JSON.stringify(purpose)}`.toLowerCase();
  return /\b(existing sales|paid clients|subscription renewals|recurring revenue|mrr|arr)\b/.test(blob);
}

export function determineDemandProofClass(ctx: ScoringContext): number {
  const measurable = ctx.profile.goal_measurable_outcome;
  const purpose = ctx.profile.structured_purpose as Record<string, unknown>;
  if (hasProvenExchange(ctx.profile.structured_goal, purpose, measurable)) {
    return 5;
  }
  if (hasValidatedDemandSignal(ctx.profile.structured_goal, purpose, measurable)) {
    return 4;
  }
  if (ctx.paying_for_alternatives === true) return 2;
  if (ctx.competitors.length > 0) return 2;
  if (ctx.problem_urgency?.trim()) return 1;
  if (!ctx.profile.structured_goal?.trim() && !ctx.problem_urgency) return 0;
  return ctx.profile.structured_goal?.trim() ? 1 : 0;
}

function feasibilityRating(score: number): string {
  if (score < 20) return "blocked";
  if (score < 40) return "unlikely";
  if (score < 60) return "stretched";
  if (score < 80) return "possible";
  return "strongly_feasible";
}

function archetypeRequiresCapital(archetypeId: string): boolean {
  return ["saas_platform", "marketplace_exchange", "physical_product_inventory"].includes(archetypeId);
}

function archetypeMinimumTeam(archetypeId: string): number {
  if (archetypeId === "marketplace_exchange") return 2;
  if (archetypeId === "saas_platform") return 1;
  return 1;
}

export function scoreValidationDimensions(
  ctx: ScoringContext,
  thresholds: TierThresholds,
  archetypeId: string,
): DimensionScores {
  const profile = ctx.profile;
  const purpose = (profile.structured_purpose ?? {}) as Record<string, unknown>;
  const contradiction_score = Number(
    ctx.contradiction_flags.length > 0
      ? Math.min(100, 40 + ctx.contradiction_flags.length * 15)
      : 0,
  );

  let market = 50;
  if (profile.location?.trim()) market += 0;
  if (ctx.competitors.length > 0) market += 20;
  if (ctx.differentiation?.trim()) market += 15;
  if (hasSpecificTarget(ctx.target_who)) market += 15;
  if (profile.market_maturity === "saturated" && !ctx.differentiation?.trim()) market -= 20;
  if (profile.market_scope === "global" && (profile.budget_usd_estimate ?? 0) < 1000) market -= 30;

  const demand_proof_class = determineDemandProofClass(ctx);
  let demand = CLASS_TO_SCORE[demand_proof_class] ?? 0;
  if (ctx.paying_for_alternatives === true) demand += 10;
  if (!ctx.problem_urgency?.trim() || ctx.problem_urgency.trim().length < 4) demand -= 20;

  let feasibility = 70;
  if (impliesFullTimeWork(profile.success_30_days) && (profile.hours_per_week ?? 0) < 5) feasibility -= 30;
  if ((profile.budget_usd_estimate ?? 0) === 0 && archetypeRequiresCapital(archetypeId)) feasibility -= 20;
  if ((profile.team_size ?? 1) < archetypeMinimumTeam(archetypeId)) feasibility -= 15;
  const launchDays = parseTimelineDays(profile.timeline_launch);
  if (launchDays !== null && launchDays <= 30 && (profile.hours_per_week ?? 0) < 20) feasibility -= 25;
  if (profile.skills_present.length >= 3) feasibility += 15;

  let context = 50;
  const priorAttempts = Array.isArray(profile.prior_attempts) ? profile.prior_attempts : [];
  if (priorAttempts.length > 0) context += 20;
  if (profile.skills_present.length >= 3) context += 15;
  if (contradiction_score > 60) context -= 25;
  if (ctx.contradiction_flags.some((f) => f.includes("RESOURCE_TIMELINE_MISMATCH"))) context -= 30;

  let evidence = 45;
  if (profile.skills_present.length >= 2) evidence += 15;
  if (priorAttempts.length > 0) evidence += 15;
  if (demand_proof_class >= 3) evidence += 25;

  const weighted =
    market * thresholds.market_weight +
    demand * thresholds.demand_weight +
    feasibility * thresholds.feasibility_weight +
    context * thresholds.context_weight;

  const overall = clampScore(weighted * (1 - contradiction_score / 200));

  return {
    market_viability_score: clampScore(market),
    demand_proof_score: clampScore(demand),
    feasibility_score: clampScore(feasibility),
    context_readiness_score: clampScore(context),
    contradiction_score: clampScore(contradiction_score),
    evidence_quality_score: clampScore(evidence),
    overall_validation_score: overall,
    demand_proof_class,
    feasibility_rating: feasibilityRating(feasibility),
  };
}

export function buildScoringContext(
  profile: RealityProfileRow,
  sessionMeta: {
    missing_fields?: string[] | null;
    contradiction_flags?: string[] | null;
  },
): ScoringContext {
  const purpose = (profile.structured_purpose ?? {}) as Record<string, unknown>;
  return {
    profile,
    missing_fields: sessionMeta.missing_fields ?? [],
    contradiction_flags: sessionMeta.contradiction_flags ?? [],
    paying_for_alternatives:
      typeof purpose.paying_for_alternatives === "boolean"
        ? purpose.paying_for_alternatives
        : null,
    problem_urgency: typeof purpose.problem_solved === "string" ? purpose.problem_solved : null,
    target_who: typeof purpose.target_who === "string" ? purpose.target_who : null,
    differentiation: typeof purpose.differentiation === "string" ? purpose.differentiation : null,
    competitors: [],
  };
}

export function thresholdRowToTierThresholds(row: {
  tier: string;
  proceed_min_score: number;
  adjust_min_score: number;
  pivot_max_score: number;
  market_weight: string | number;
  demand_weight: string | number;
  feasibility_weight: string | number;
  context_weight: string | number;
  demand_proof_min_class: number;
}): TierThresholds {
  return {
    tier: row.tier as MatrixTier,
    proceed_min_score: row.proceed_min_score,
    adjust_min_score: row.adjust_min_score,
    pivot_max_score: row.pivot_max_score,
    market_weight: Number(row.market_weight),
    demand_weight: Number(row.demand_weight),
    feasibility_weight: Number(row.feasibility_weight),
    context_weight: Number(row.context_weight),
    demand_proof_min_class: row.demand_proof_min_class,
  };
}

/** Gap Fix 1 — minimal profile for 5-question free intake. */
export type MinimalFreeProfile = {
  industry: string | null;
  location: string | null;
  budget_range: string | null;
  budget_usd_estimate: number | null;
  timeline_launch: string | null;
  operating_context: string | null;
  market_maturity: string | null;
};

export function minimalFreeProfileFromRow(profile: RealityProfileRow): MinimalFreeProfile {
  return {
    industry: profile.industry ?? null,
    location: profile.location ?? null,
    budget_range: profile.budget_range ?? null,
    budget_usd_estimate: profile.budget_usd_estimate ?? null,
    timeline_launch: profile.timeline_launch ?? null,
    operating_context: profile.operating_context ?? null,
    market_maturity: profile.market_maturity ?? null,
  };
}

export function parseTimelineToMonths(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const lower = value.toLowerCase();
  const monthMatch = lower.match(/(\d+)\s*month/);
  if (monthMatch) return Number(monthMatch[1]);
  const weekMatch = lower.match(/(\d+)\s*week/);
  if (weekMatch) return Math.max(1, Math.round(Number(weekMatch[1]) / 4));
  const yearMatch = lower.match(/(\d+)\s*year/);
  if (yearMatch) return Number(yearMatch[1]) * 12;
  if (lower.includes("12_months_plus") || lower.includes("12+")) return 12;
  if (lower.includes("6_month")) return 6;
  if (lower.includes("3_month")) return 3;
  if (lower.includes("1_month")) return 1;
  const days = parseTimelineDays(value);
  if (days !== null) return Math.max(1, Math.round(days / 30));
  return null;
}

/** Free tier: 3 scoreable dimensions only (market + feasibility); demand/context not assessed. */
export function scoreDimensionsForFreeTier(profile: MinimalFreeProfile): DimensionScores {
  let market = 50;
  if (profile.market_maturity === "emerging") market += 10;
  if (profile.market_maturity === "saturated") market -= 20;
  if (profile.operating_context === "informal") market += 5;
  if (!profile.industry?.trim()) market = 20;

  let feasibility = 60;
  const budget = profile.budget_usd_estimate ?? 0;
  if (budget >= 5000) feasibility += 20;
  else if (budget >= 1000) feasibility += 10;
  else if (budget >= 100) feasibility += 0;
  else feasibility -= 20;

  const timelineMonths = parseTimelineToMonths(profile.timeline_launch);
  if (timelineMonths !== null) {
    if (timelineMonths > 6) feasibility += 10;
    if (timelineMonths <= 1) feasibility -= 25;
  }

  const marketScore = clampScore(market);
  const feasibilityScore = clampScore(feasibility);
  const overall = clampScore(marketScore * 0.5 + feasibilityScore * 0.5);

  return {
    market_viability_score: marketScore,
    demand_proof_score: 0,
    feasibility_score: feasibilityScore,
    context_readiness_score: 30,
    contradiction_score: 0,
    evidence_quality_score: 0,
    confidence_score: 40,
    overall_validation_score: overall,
    demand_proof_class: 0,
    feasibility_rating:
      feasibilityScore >= 60 ? "possible" : feasibilityScore >= 40 ? "unlikely" : "blocked",
    is_free_tier_preview: true,
  };
}
