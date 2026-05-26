/**
 * Maps Erector validation output to 20 editable workspace sections (Prompt spec stages 1–20).
 */
import type { ErectorValidationResult } from "../../types/erector.js";
import type { ErectorValidationInput } from "../../types/erector.js";
import type { ValidationSectionCard, ValidationSectionId } from "../../types/erector-refinement.js";

const SECTION_META: Array<{ id: ValidationSectionId; title: string; stage: number }> = [
  { id: "intake_confirmation", title: "Intake Confirmation", stage: 1 },
  { id: "purpose_decomposition", title: "Purpose Decomposition", stage: 2 },
  { id: "economic_type", title: "Economic Type", stage: 3 },
  { id: "business_patterns", title: "Business Pattern Matching", stage: 4 },
  { id: "economy_timing", title: "Economy + Timing", stage: 5 },
  { id: "market_analysis", title: "Market Analysis", stage: 6 },
  { id: "social_channels", title: "Social & Channels", stage: 7 },
  { id: "pros", title: "Pros", stage: 8 },
  { id: "cons", title: "Cons", stage: 9 },
  { id: "feasibility", title: "Feasibility", stage: 10 },
  { id: "viability", title: "Viability", stage: 11 },
  { id: "bootstrap_summary", title: "Bootstrap Summary", stage: 12 },
  { id: "feature_recommendation", title: "Feature Recommendation", stage: 13 },
  { id: "customer_definition", title: "Customer Definition", stage: 14 },
  { id: "positioning", title: "Positioning", stage: 15 },
  { id: "difficulty_breakdown", title: "Difficulty Breakdown", stage: 16 },
  { id: "revenue_path", title: "Revenue Path", stage: 17 },
  { id: "first_90_days", title: "First 90 Days", stage: 18 },
  { id: "execution_paths", title: "Execution Path Options", stage: 19 },
  { id: "final_decision", title: "Final Decision", stage: 20 },
];

function prosFromResult(result: ErectorValidationResult): Record<string, unknown> {
  const opps = result.archetypeResolution?.economySpecificOpportunities ?? [];
  const items = opps.slice(0, 4).map((text, i) => ({
    title: `Pro ${i + 1}`,
    explanation: text,
  }));
  return { items, count: items.length };
}

function consFromResult(result: ErectorValidationResult): Record<string, unknown> {
  const risks = result.archetypeResolution?.economySpecificWarnings ?? [];
  const items = risks.slice(0, 4).map((text, i) => ({
    title: `Con ${i + 1}`,
    explanation: text,
  }));
  return { items, count: items.length };
}

export function buildValidationSections(
  result: ErectorValidationResult,
  input: ErectorValidationInput & { goalFinal?: string; purposeFinal?: string; economicType?: string },
): ValidationSectionCard[] {
  const goal = input.goalFinal ?? input.rawGoal;
  const purpose = input.purposeFinal ?? input.purpose;
  const archetype = result.archetypeResolution?.primaryArchetype;
  const market = result.marketAnalysis as Record<string, unknown>;
  const competitors = result.competitorAnalysis as Record<string, unknown>;
  const industry = result.industryIntelligence as Record<string, unknown>;
  const pain = result.customerPainAnalysis as Record<string, unknown>;
  const difficulty = result.executionDifficulty as Record<string, unknown>;
  const economy = result.economyBriefing as Record<string, unknown>;
  const timing = (result as { timingAnalysis?: Record<string, unknown> }).timingAnalysis ?? {};

  const contentById: Record<ValidationSectionId, Record<string, unknown>> = {
    intake_confirmation: {
      checks: {
        goal: Boolean(goal),
        purpose: Boolean(purpose),
        timeframe: Boolean(input.timeframe),
        country: Boolean(input.location?.country),
        economicType: Boolean(input.economicType ?? archetype?.name),
        businessType: Boolean(input.businessType),
        targetCustomer: Boolean(input.targetCustomer),
      },
      goal_final: goal,
      purpose_final: purpose,
    },
    purpose_decomposition: (result.purposeDecomposition as Record<string, unknown>) ?? {},
    economic_type: {
      country: input.location.country,
      economicType: input.economicType ?? archetype?.name,
      archetypeNumber: archetype?.archetypeNumber,
      implications: archetype?.consumerBehaviorPatterns ?? [],
    },
    business_patterns: {
      successfulBusinesses: competitors?.winners ?? competitors?.competitors ?? industry?.examples ?? [],
      learnings: industry?.patterns ?? [],
    },
    economy_timing: { economy, timing, marketMaturity: market?.maturity, demandDirection: market?.demand },
    market_analysis: {
      demand: market?.demand ?? market?.demandSummary,
      competition: market?.competition ?? market?.competitionSummary,
      opportunity: market?.opportunity ?? market?.gap,
      points: market?.points ?? market,
    },
    social_channels: {
      channels: market?.channels ?? [
        { name: "Instagram", why: "Visual proof and community discovery for consumer offers." },
        { name: "TikTok", why: "Short-form demos reach new audiences quickly." },
        { name: "Email", why: "Retention and direct relationship with early users." },
      ],
    },
    pros: prosFromResult(result),
    cons: consFromResult(result),
    feasibility: {
      technical: difficulty?.technical ?? result.scores.executionScore,
      time: difficulty?.time ?? input.timeframe,
      budget: input.budgetAvailable,
      skills: input.currentResources,
      gaps: difficulty?.gaps ?? [],
      score: result.scores.executionScore,
    },
    viability: {
      revenue: result.scores.marketScore,
      retention: result.scores.momentumPotential,
      pricing: input.businessModel,
      distribution: input.businessType,
      score: result.scores.realityScore,
    },
    bootstrap_summary: {
      minimumVersion: industry?.mvp ?? "Smallest proof that solves one painful moment",
      firstUsers: pain?.earlyAdopters ?? input.targetCustomer,
      firstOffer: input.businessModel,
      avoidEarly: industry?.avoid ?? ["Over-building before proof"],
    },
    feature_recommendation: {
      buildFirst: industry?.buildFirst ?? ["Core workflow", "Proof capture"],
      buildLater: industry?.buildLater ?? ["Automation", "Advanced analytics"],
      avoidForNow: industry?.avoidForNow ?? ["Full platform scope"],
    },
    customer_definition: {
      primary: input.targetCustomer,
      secondary: pain?.secondary ?? "Adjacent users with similar pain",
      avoid: pain?.avoid ?? "Broad everyone positioning",
      first100: pain?.first100 ?? "Manually recruited early believers",
    },
    positioning: {
      uniqueAngle: market?.positioning ?? `Focused ${input.businessType} for ${input.targetCustomer}`,
      switchingReason: market?.whySwitch ?? "More relevant than generic alternatives",
      message: goal,
      differentiation: industry?.differentiation,
    },
    difficulty_breakdown: {
      building: difficulty?.building ?? difficulty,
      marketing: difficulty?.marketing,
      retention: difficulty?.retention,
      operations: difficulty?.operations,
    },
    revenue_path: {
      paths: [
        "Free acquisition → paid conversion",
        input.businessModel,
        "Coaching or premium tier",
        "Partnerships",
      ],
      model: input.businessModel,
    },
    first_90_days: {
      month1: result.paths?.current?.firstWeekActionsPreview?.slice(0, 3) ?? ["Validate offer", "Talk to users"],
      month2: ["Iterate offer", "Improve retention loop"],
      month3: ["Scale what worked", "Document playbooks"],
      milestone: input.desiredOutcome,
      firstWeekPlan: (result as { firstWeekPlan?: unknown }).firstWeekPlan,
    },
    execution_paths: {
      foundation: result.paths?.current,
      momentum: result.paths?.adjusted,
      overdrive: result.paths?.alternative,
    },
    final_decision: {
      decision: result.verdict,
      explanation: result.scores.verdict,
      realityScore: result.scores.realityScore,
      recommendedTier: result.recommendedBlueprintLevel,
    },
  };

  return SECTION_META.map((meta) => ({
    id: meta.id,
    title: meta.title,
    sequenceStage: meta.stage,
    content: contentById[meta.id] ?? {},
    summary: meta.title,
    lastUpdatedAt: new Date().toISOString(),
  }));
}

/** Which Bhudhi triggers to re-run when a section is edited. */
export const SECTION_RECALC_DEPENDENCIES: Partial<Record<ValidationSectionId, string[]>> = {
  business_patterns: ["VALIDATE_STAGE_15_POSITIONING"],
  economy_timing: ["VALIDATE_STAGE_19_PATHS"],
  market_analysis: ["VALIDATE_STAGE_10_FEASIBILITY", "VALIDATE_STAGE_11_VIABILITY", "VALIDATE_STAGE_17_REVENUE"],
  social_channels: ["VALIDATE_STAGE_14_CUSTOMER", "VALIDATE_STAGE_18_90DAYS"],
  feasibility: ["VALIDATE_STAGE_19_PATHS", "VALIDATE_STAGE_20_DECISION"],
  viability: ["VALIDATE_STAGE_19_PATHS", "VALIDATE_STAGE_20_DECISION"],
};
