/**
 * Erector intelligence extensions — economic reality, archetypes, readiness, white space, timing, revenue.
 * Attached to validation intelligence payloads; does not replace the 20-stage pipeline.
 */

export const ECONOMIC_REALITY_ENGINE = {
  indicators: [
    "GDP_per_capita",
    "purchasing_power_parity",
    "digital_economy_size",
    "startup_ecosystem_maturity",
    "venture_capital_availability",
    "regulatory_ease_score",
    "internet_penetration",
    "mobile_payment_adoption",
    "middle_class_size",
    "inflation_rate_current",
    "currency_stability",
    "political_risk_index",
  ],
  zones: {
    USD_ECONOMY: {
      label: "USD Economy (USA)",
      characteristics:
        "Largest consumer market, highest SaaS pricing tolerance, strong VC ecosystem",
      avgSaasPrice: "$29-99/month",
      paymentMethods: "Credit cards dominant, PayPal, Stripe widely accepted",
      executionImplication:
        "Build for premium positioning. Price confidently. VC funding available.",
    },
    EURO_ZONE: {
      label: "Euro Zone",
      characteristics: "Strong GDPR compliance requirements, privacy-conscious market",
      avgSaasPrice: "€19-79/month",
      paymentMethods: "Credit cards, SEPA, local methods vary by country",
      executionImplication: "GDPR compliance is mandatory. Privacy features are selling points.",
    },
    EMERGING_MARKET: {
      label: "Emerging Market",
      characteristics: "Price-sensitive, mobile-first, rapid growth",
      avgSaasPrice: "$5-19/month",
      paymentMethods: "Mobile money, local payment rails dominant",
      executionImplication: "Mobile-first mandatory. Lower price points. Volume strategy.",
    },
    FRONTIER_MARKET: {
      label: "Frontier Market",
      characteristics: "Infrastructure gaps, high growth potential, trust barriers",
      avgSaasPrice: "$2-9/month",
      paymentMethods: "Cash, mobile money, limited card acceptance",
      executionImplication:
        "Offline-capable features matter. Community trust building essential.",
    },
  },
} as const;

export const FOUNDER_ARCHETYPES = {
  VISIONARY_BUILDER: {
    traits: ["big picture thinking", "product-first", "technical focus"],
    validationFocus: "Heavy emphasis on market demand and distribution",
  },
  MARKET_MOVER: {
    traits: ["sales-oriented", "customer-first", "revenue focused"],
    validationFocus: "Heavy emphasis on execution feasibility and product-market fit",
  },
  OPERATOR: {
    traits: ["process-oriented", "systematic", "risk-averse"],
    validationFocus: "Heavy emphasis on differentiation and market positioning",
  },
  CREATIVE: {
    traits: ["design-focused", "brand-driven", "audience-first"],
    validationFocus: "Heavy emphasis on monetization paths and revenue model",
  },
  ANALYST: {
    traits: ["data-driven", "research-first", "risk-calculator"],
    validationFocus: "Heavy emphasis on bias detection and action forcing",
  },
} as const;

export type FounderArchetype = keyof typeof FOUNDER_ARCHETYPES;

export function detectFounderArchetype(goal: string, purpose: string): FounderArchetype {
  const text = `${goal} ${purpose}`.toLowerCase();
  if (/sales|customer|revenue|market/i.test(text)) return "MARKET_MOVER";
  if (/design|brand|creative|audience/i.test(text)) return "CREATIVE";
  if (/data|research|analyze|evidence/i.test(text)) return "ANALYST";
  if (/process|system|operations|efficiency/i.test(text)) return "OPERATOR";
  return "VISIONARY_BUILDER";
}

/** 12-stage user-facing validation map (orchestration may run 20 internal stages). */
export const ERECTOR_VALIDATION_STAGES = [
  { stage: 1, name: "Goal Understanding", engine: "GOAL_STRUCTURING", duration: 4 },
  { stage: 2, name: "Purpose Decomposition", engine: "PURPOSE_ANALYSIS", duration: 4 },
  { stage: 3, name: "Reality Matching", engine: "REALITY_CHECK", duration: 5 },
  { stage: 4, name: "Economic Environment", engine: "ERECTOR_ECONOMY_BRIEFING", duration: 6 },
  { stage: 5, name: "Market Demand Analysis", engine: "ERECTOR_MARKET_ANALYZE", duration: 8 },
  { stage: 6, name: "Competitor Intelligence", engine: "ERECTOR_COMPETITORS_IDENTIFY", duration: 8 },
  { stage: 7, name: "Opportunity Detection", engine: "OPPORTUNITY_MAPPING", duration: 6 },
  { stage: 8, name: "Risk Classification", engine: "RISK_CLASSIFICATION", duration: 6 },
  { stage: 9, name: "Timing Analysis", engine: "VALIDATE_STAGE_5_TIMING", duration: 5 },
  { stage: 10, name: "Execution Feasibility", engine: "EXECUTION_FEASIBILITY", duration: 5 },
  { stage: 11, name: "Path Generation", engine: "PATH_GENERATOR", duration: 7 },
  { stage: 12, name: "Final Intelligence Report", engine: "INSIGHT_COMPILER", duration: 6 },
] as const;

export interface ExecutionReadinessScore {
  overallScore: number;
  label: "Not Ready" | "Partially Ready" | "Ready" | "Highly Ready";
  founderArchetype: string;
  criticalGaps: string[];
  quickWins: string[];
  readinessVerdict: string;
}

export function buildExecutionReadinessScore(params: {
  goal: string;
  purpose: string;
  marketScore?: number;
  feasibilityScore?: number;
}): ExecutionReadinessScore {
  const archetype = detectFounderArchetype(params.goal, params.purpose);
  const market = params.marketScore ?? 55;
  const feasibility = params.feasibilityScore ?? 50;
  const overall = Math.round((market + feasibility) / 2);
  const label =
    overall >= 75 ? "Highly Ready"
    : overall >= 60 ? "Ready"
    : overall >= 40 ? "Partially Ready"
    : "Not Ready";
  return {
    overallScore: overall,
    label,
    founderArchetype: archetype,
    criticalGaps:
      overall < 60 ?
        ["Validate demand with 5 target-user interviews", "Define first revenue path"]
      : [],
    quickWins: ["Ship a narrow MVP scoped to one user segment", "Set weekly proof-of-progress ritual"],
    readinessVerdict: `${label} — leverage ${archetype} strengths; address blind spots per archetype profile.`,
  };
}

export function buildErectorIntelligenceExtensions(input: {
  goal: string;
  purpose: string;
  location?: string;
  domain?: string;
  marketScore?: number;
}): Record<string, unknown> {
  const archetype = detectFounderArchetype(input.goal, input.purpose);
  const readiness = buildExecutionReadinessScore({
    goal: input.goal,
    purpose: input.purpose,
    marketScore: input.marketScore,
  });
  return {
    economicReality: ECONOMIC_REALITY_ENGINE,
    founderArchetype: FOUNDER_ARCHETYPES[archetype],
    archetypeKey: archetype,
    validationStages: ERECTOR_VALIDATION_STAGES,
    executionReadiness: readiness,
    whiteSpaceMap: {
      recommendedEntry: {
        primaryGap: "Underserved segment with manual workflows",
        rationale: "Competitors optimize for enterprise; solo operators remain underserved",
        firstActionToCapture: "Interview 5 users in the gap segment within 7 days",
      },
    },
    marketTiming: {
      timingVerdict: "Perfect Timing",
      competitiveWindow: {
        monthsBeforeMarketCrowded: 18,
        urgencyLevel: "medium",
        firstMoverAdvantageAvailable: true,
      },
    },
    revenueModel: {
      recommendedModels: [
        {
          model: "subscription",
          fit: "good",
          rationale: "Recurring value aligns with ongoing execution support",
          estimatedArpu: "$19-49/month",
        },
      ],
      firstRevenueStrategy: {
        approach: "Pre-sell to design partners before full build",
        estimatedDaysToFirstRevenue: 45,
      },
    },
  };
}
