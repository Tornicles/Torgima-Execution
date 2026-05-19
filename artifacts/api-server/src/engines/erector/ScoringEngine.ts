import type { ArchetypeResolutionOutput, EconomicArchetypeProfile, ErectorScores, ErectorValidationInput } from "../../types/erector.js";

function clamp(score: number): number {
  return Math.max(0, Math.min(10, Number(score.toFixed(1))));
}

function budgetScore(input: ErectorValidationInput): number {
  if (input.budgetAvailable >= 10000) return 8;
  if (input.budgetAvailable >= 2500) return 6.5;
  if (input.budgetAvailable >= 500) return 5;
  return 3.2;
}

function commitmentScore(level: string): number {
  const l = level.toLowerCase();
  if (l === "intense" || l === "full") return 8.5;
  if (l === "high") return 7;
  if (l === "medium") return 5.5;
  return 3.8;
}

export function calculateMarketScore(marketAnalysis: Record<string, unknown>, archetype: EconomicArchetypeProfile): number {
  return clamp(Number(marketAnalysis["demandScore"] ?? 6) + archetype.consumerPurchasingPower * 0.15 - archetype.marketCompetitionDensity * 0.12);
}

export function calculateExecutionScore(input: ErectorValidationInput, archetype: EconomicArchetypeProfile): number {
  const resource = Math.min(8, input.currentResources.length * 1.15 + budgetScore(input) * 0.55);
  return clamp((resource + commitmentScore(input.commitmentLevel)) / 2 - archetype.executionIntensityMultiplier * 0.8);
}

export function calculateTimingScore(timingAnalysis: Record<string, unknown>, archetype: EconomicArchetypeProfile): number {
  return clamp(Number(timingAnalysis["momentumScore"] ?? 6) - (archetype.timeframePressureMultiplier - 1) * 3);
}

export function calculateCompetitionScore(competitorAnalysis: Record<string, unknown>, archetype: EconomicArchetypeProfile): number {
  const count = Array.isArray(competitorAnalysis["competitors"]) ? competitorAnalysis["competitors"].length : 3;
  return clamp(8 - archetype.marketCompetitionDensity * 0.35 - count * 0.18);
}

export function calculateScalabilityScore(marketAnalysis: Record<string, unknown>, archetype: EconomicArchetypeProfile): number {
  return clamp(Number(marketAnalysis["scalabilityScore"] ?? 6) + archetype.digitalAdoption * 0.2 - archetype.infrastructureQuality * -0.05);
}

export function calculateLocalEconomyScore(archetype: EconomicArchetypeProfile): number {
  return clamp((archetype.institutionalStrength + archetype.infrastructureQuality + archetype.digitalAdoption + archetype.regulatoryOpenness) / 4 - archetype.corruptionIndex * 0.2);
}

export function calculateResourceScore(input: ErectorValidationInput, archetype: EconomicArchetypeProfile): number {
  return clamp(budgetScore(input) * 0.55 + input.currentResources.length * 0.75 - archetype.blueprintDifficultyAdjustment * 0.8);
}

export function calculateBlueprintDifficultyScore(archetype: EconomicArchetypeProfile): number {
  return clamp(5 + archetype.executionIntensityMultiplier + archetype.blueprintDifficultyAdjustment + archetype.corruptionIndex * 0.12);
}

export function calculateRiskScore(scores: Omit<ErectorScores, "riskScore" | "realityScore" | "verdict" | "recommendedBlueprintLevel">, archetype: EconomicArchetypeProfile): number {
  const weakAverage = (10 - scores.marketScore + 10 - scores.executionScore + 10 - scores.localEconomyScore) / 3;
  return clamp(weakAverage * 0.55 + archetype.corruptionIndex * 0.35 + archetype.blueprintDifficultyAdjustment);
}

export function calculateRealityScore(scores: Pick<ErectorScores, "marketScore" | "executionScore" | "localEconomyScore" | "riskScore" | "timingScore" | "competitionScore">): number {
  return clamp(
    scores.marketScore * 0.25 +
      scores.executionScore * 0.2 +
      scores.localEconomyScore * 0.2 +
      (10 - scores.riskScore) * 0.15 +
      scores.timingScore * 0.1 +
      scores.competitionScore * 0.1,
  );
}

export function determineVerdict(realityScore: number): ErectorScores["verdict"] {
  if (realityScore >= 6.5) return "proceed";
  if (realityScore >= 4) return "adjust";
  return "pivot";
}

export function recommendBlueprintLevel(realityScore: number, archetype: EconomicArchetypeProfile): ErectorScores["recommendedBlueprintLevel"] {
  if (realityScore >= 7.5 && archetype.blueprintDifficultyAdjustment <= 1) return "ultimate";
  if (realityScore >= 5) return "growth";
  return "starter";
}

export function calculateAllScores(params: {
  input: ErectorValidationInput;
  archetypeResolution: ArchetypeResolutionOutput;
  marketAnalysis: Record<string, unknown>;
  competitorAnalysis: Record<string, unknown>;
  timingAnalysis: Record<string, unknown>;
}): ErectorScores {
  const archetype = params.archetypeResolution.primaryArchetype;
  const base = {
    marketScore: calculateMarketScore(params.marketAnalysis, archetype),
    executionScore: calculateExecutionScore(params.input, archetype),
    timingScore: calculateTimingScore(params.timingAnalysis, archetype),
    competitionScore: calculateCompetitionScore(params.competitorAnalysis, archetype),
    scalabilityScore: calculateScalabilityScore(params.marketAnalysis, archetype),
    localEconomyScore: calculateLocalEconomyScore(archetype),
    resourceScore: calculateResourceScore(params.input, archetype),
    blueprintDifficultyScore: calculateBlueprintDifficultyScore(archetype),
    momentumPotential: clamp(Number(params.timingAnalysis["momentumScore"] ?? 6)),
    trustBuildingScore: clamp(10 - archetype.corruptionIndex * 0.45 + archetype.institutionalStrength * 0.2),
  };
  const riskScore = calculateRiskScore(base, archetype);
  const realityScore = calculateRealityScore({ ...base, riskScore });
  return {
    ...base,
    riskScore,
    realityScore,
    verdict: determineVerdict(realityScore),
    recommendedBlueprintLevel: recommendBlueprintLevel(realityScore, archetype),
  };
}
