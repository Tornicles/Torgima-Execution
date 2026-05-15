import type { EISIntelligence, FeasibilityAssessment, IndustryClassification, ValidationTabContent } from "./validation-intelligence-types.js";

export function buildValidationTabs(params: {
  classification: IndustryClassification;
  eis: EISIntelligence;
  feasibility: FeasibilityAssessment;
  goal: string;
}): ValidationTabContent {
  const { eis, feasibility, classification, goal } = params;

  return {
    market: {
      industryPosition: `${classification.industry} — ${classification.niche}`,
      marketMaturity:
        eis.saturation_level === "critical" ? "Mature / crowded"
        : eis.demand_signal.direction === "rising" ? "Growing"
        : "Emerging",
      audienceClarity: goal.length > 40 ? "Moderately defined" : "Needs sharper segment definition",
      channelLandscape: eis.platform_context.map((p) => `${p.platform}: ${p.implication}`).join("; "),
      positioningOpportunity: eis.competitor_landscape[0]?.gap_opportunities[0] ?? "Niche differentiation",
      marketRisks: eis.macro_trends.map((t) => t.summary).slice(0, 2),
      source: "EIS + CIS",
    },
    demand: {
      demandSignal: `${eis.demand_signal.direction} (${eis.demand_signal.strength})`,
      demandEvidence: eis.demand_signal.evidence,
      realVsFakeDemand: "Real: paid/commitment signals. Fake: vanity metrics without conversion.",
      demandProofRequirements: "10 conversations, 3 commitments, or 1 paid pilot",
      firstDemandTask: "Run smallest offer test to one target segment",
      source: "EIS",
    },
    feasibility: {
      timeframeReality: feasibility.timeframeRealistic ? "Realistic with focus" : "Likely too aggressive",
      effortEstimate: feasibility.effortLevel,
      skillRequirements: feasibility.skillRequirements,
      resourceRequirements: feasibility.resourceRequirements,
      executionComplexity: feasibility.complexity,
      feasibilityScore: String(feasibility.score),
      feasibilityRisks: feasibility.risks,
      source: "FeasibilityCalculator",
    },
    context: {
      industryStage: eis.macro_trends[0]?.summary ?? "Active execution environment",
      entryPoint:
        eis.demand_signal.direction === "rising" ? "Optimal — demand rising"
        : eis.demand_signal.direction === "declining" ? "Late / risky"
        : "Moderate",
      competitiveContext: eis.competitor_landscape.map((c) => `${c.name} (${c.threat_level})`).join(", "),
      differentiationRequirements: eis.competitor_landscape.flatMap((c) => c.gap_opportunities).slice(0, 3),
      externalForces: eis.macro_trends.map((t) => t.label),
      strategicAlignment:
        feasibility.score >= 50 ? "Aligned with current conditions" : "Misaligned — adjust before scale",
      source: "SIS + EIS",
    },
  };
}
