import { validations } from "@workspace/db";
import type { ErectorValidationResult } from "../../types/erector.js";

export function rowToErectorResult(row: typeof validations.$inferSelect): ErectorValidationResult {
  return {
    validationId: row.id,
    validationContractId: row.contract_id,
    blueprintId: row.blueprint_id,
    validationStage: row.validation_stage ?? row.status,
    verdict: (row.verdict ?? "adjust") as ErectorValidationResult["verdict"],
    scores: {
      marketScore: row.market_score ?? 0,
      executionScore: row.execution_score ?? 0,
      timingScore: row.timing_score ?? 0,
      competitionScore: row.competition_score ?? 0,
      scalabilityScore: row.scalability_score ?? 0,
      localEconomyScore: row.local_economy_score ?? 0,
      resourceScore: row.resource_score ?? 0,
      blueprintDifficultyScore: row.blueprint_difficulty_score ?? 0,
      riskScore: row.risk_score ?? 0,
      momentumPotential: row.momentum_potential ?? 0,
      trustBuildingScore: row.trust_building_score ?? 0,
      realityScore: row.reality_score ?? 0,
      verdict: (row.verdict ?? "adjust") as ErectorValidationResult["verdict"],
      recommendedBlueprintLevel: (row.recommended_blueprint_level ?? "starter") as ErectorValidationResult["recommendedBlueprintLevel"],
    },
    archetypeResolution: row.archetype_resolution as ErectorValidationResult["archetypeResolution"],
    purposeDecomposition: (row.purpose_decomposition as Record<string, unknown>) ?? {},
    industryIntelligence: (row.industry_intelligence as Record<string, unknown>) ?? {},
    marketAnalysis: (row.market_analysis as Record<string, unknown>) ?? {},
    competitorAnalysis: (row.competitor_analysis as Record<string, unknown>) ?? {},
    economyBriefing: (row.economy_briefing as Record<string, unknown>) ?? {},
    customerPainAnalysis: (row.customer_pain_analysis as Record<string, unknown>) ?? {},
    executionDifficulty: (row.execution_difficulty as Record<string, unknown>) ?? {},
    timeSimulations: (row.time_simulations as ErectorValidationResult["timeSimulations"]) ?? [],
    paths: {
      current: row.path_current as ErectorValidationResult["paths"]["current"],
      adjusted: row.path_adjusted as ErectorValidationResult["paths"]["adjusted"],
      alternative: row.path_alternative as ErectorValidationResult["paths"]["alternative"],
    },
    recommendedBlueprintLevel: (row.recommended_blueprint_level ?? "starter") as ErectorValidationResult["recommendedBlueprintLevel"],
  };
}
