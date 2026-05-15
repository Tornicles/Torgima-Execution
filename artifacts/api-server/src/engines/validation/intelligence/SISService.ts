import type { BlueprintTier } from "../../blueprint/infrastructure/blueprint-types.js";
import type { StructuredGoalDraft, ValidationScores, ValidationVerdict } from "../../../types/validation.js";
import {
  generatePathsDeterministic,
  generateValidationPathsWithBhudhi,
} from "../ValidationEngine.js";
import type {
  EISIntelligence,
  EnrichedValidationPath,
  FeasibilityAssessment,
  PathScenario,
} from "./validation-intelligence-types.js";

export async function generateStrategicPaths(params: {
  blueprintId: string;
  userId: string;
  goal: string;
  purpose?: string;
  timeframe?: string;
  commitmentLevel?: string;
  scores: ValidationScores;
  verdict: ValidationVerdict;
  eis: EISIntelligence;
  feasibility: FeasibilityAssessment;
  iis: StructuredGoalDraft;
  tier: BlueprintTier;
  aiEnabled: boolean;
}): Promise<{
  current: EnrichedValidationPath;
  adjusted: EnrichedValidationPath;
  alternative: EnrichedValidationPath;
}> {
  const base =
    params.aiEnabled ?
      await generateValidationPathsWithBhudhi({
        userId: params.userId,
        blueprintId: params.blueprintId,
        goal: params.iis.cleanedGoal,
        purpose: params.purpose,
        timeframe: params.timeframe,
        commitmentLevel: params.commitmentLevel,
        scores: params.scores,
        verdict: params.verdict,
      })
    : generatePathsDeterministic({
        goal: params.iis.cleanedGoal,
        purpose: params.purpose,
        timeframe: params.timeframe,
        commitmentLevel: params.commitmentLevel,
        scores: params.scores,
        verdict: params.verdict,
      });

  const enrich = (path: typeof base.current, type: "current" | "adjusted" | "alternative"): EnrichedValidationPath => {
    const scenario = buildScenario(params, type);
    const strengths = buildStrengths(params, type);
    const risks = buildPathRisks(params, type);
    return {
      ...path,
      strengths,
      risks,
      requiredConditions: [
        "Measurable weekly proof",
        params.eis.demand_signal.demand_type === "speculative" ? "Demand validation before scale" : "Steady execution cadence",
      ],
      whatChanged:
        type === "adjusted" ?
          [
            "Tighter scope aligned to demand signals",
            "Earlier validation gate",
            `Positioning accounts for ${params.eis.saturation_level} saturation`,
          ]
        : undefined,
      unlocks:
        type === "adjusted" ? ["Lower risk entry", "Faster proof cycle"] : type === "alternative" ? ["Differentiated entry angle"] : undefined,
      scenario: params.tier === "ultimate" ? scenario : params.tier === "growth" ? { ...scenario, probabilityOfSuccess: undefined } : undefined,
      comparisonNote:
        type === "alternative" ?
          `Uses gap opportunity: ${params.eis.competitor_landscape[0]?.gap_opportunities[0] ?? "niche focus"}`
        : undefined,
    };
  };

  const adjustedSummary =
    `Improved direction: ${params.iis.cleanedGoal.slice(0, 80)} — scoped for ${params.eis.demand_signal.direction} demand and ${params.feasibility.complexity} execution complexity.`;

  const alternativeSummary =
    `Backup strategy: validate ${params.eis.niche} via smallest proof offer before scaling — serves same purpose with lower saturation exposure.`;

  return {
    current: enrich(base.current, "current"),
    adjusted: {
      ...enrich(
        {
          ...base.adjusted,
          summary: adjustedSummary,
          keyChanges:
            "Demand-first sequencing · Reduced scope · Competitive differentiation baked in",
        },
        "adjusted",
      ),
    },
    alternative: {
      ...enrich(
        {
          ...base.alternative,
          summary: alternativeSummary,
          rationale: `EIS detected ${params.eis.saturation_level} saturation — alternative reduces head-on competition.`,
        },
        "alternative",
      ),
    },
  };
}

function buildScenario(
  params: { feasibility: FeasibilityAssessment; eis: EISIntelligence; tier: BlueprintTier },
  type: "current" | "adjusted" | "alternative",
): PathScenario {
  const base = params.feasibility.score;
  const mod = type === "adjusted" ? 8 : type === "alternative" ? 5 : 0;
  const p = Math.min(90, base + mod);
  return {
    bestCase: `Strong traction in ${params.eis.industry} with clear demand proof within timeframe`,
    likelyCase: `Steady progress with 1–2 validated milestones; adjustments likely`,
    worstCase: `Demand proof fails or scope creep stalls execution`,
    probabilityOfSuccess: params.tier === "ultimate" ? p : undefined,
  };
}

function buildStrengths(
  params: { eis: EISIntelligence; iis: StructuredGoalDraft },
  type: "current" | "adjusted" | "alternative",
): string[] {
  const s = [
    `Clear intent toward ${params.eis.industry}`,
    params.iis.cleanedGoal.length > 20 ? "Refined goal from IIS" : "Goal submitted",
  ];
  if (params.eis.demand_signal.direction === "rising") s.push("Favorable demand direction");
  if (type === "adjusted") s.push("Scope aligned to market reality");
  if (type === "alternative") s.push("Lower competitive head-on exposure");
  return s;
}

function buildPathRisks(
  params: { eis: EISIntelligence; feasibility: FeasibilityAssessment },
  type: "current" | "adjusted" | "alternative",
): string[] {
  const r: string[] = [];
  if (params.eis.saturation_level === "critical" && type === "current") r.push("High saturation on direct path");
  if (params.feasibility.score < 50) r.push("Feasibility friction");
  if (params.eis.demand_signal.strength === "weak") r.push("Demand not yet proven");
  if (type === "alternative") r.push("Pivot learning curve");
  return r;
}
