import type { BlueprintTier } from "../../blueprint/infrastructure/blueprint-types.js";
import type {
  FullValidationResult,
  IndustryIntelligencePanel,
  ValidationIntelligencePayload,
} from "./validation-intelligence-types.js";

/** Strip or simplify validation output per tier rules. */
export function applyTierDepthToResult(result: FullValidationResult, tier: BlueprintTier): FullValidationResult {
  const intel = { ...result.intelligence };
  const panel = { ...intel.industryPanel };

  if (tier === "starter") {
    intel.industryPanel = condensePanel(panel);
    intel.tabs = {
      market: pickKeys(intel.tabs.market, ["industryPosition", "marketMaturity", "positioningOpportunity"]),
      demand: pickKeys(intel.tabs.demand, ["demandSignal", "firstDemandTask"]),
      feasibility: pickKeys(intel.tabs.feasibility, ["timeframeReality", "effortEstimate", "feasibilityScore"]),
      context: pickKeys(intel.tabs.context, ["entryPoint", "strategicAlignment"]),
    };
    intel.paths = {
      current: stripPath(intel.paths.current),
      adjusted: stripPath(intel.paths.adjusted),
      alternative: stripPath(intel.paths.alternative),
    };
    intel.pis = { ...intel.pis, probability_score: undefined, kill_conditions: undefined };
  }

  return { ...result, intelligence: intel };
}

function condensePanel(panel: IndustryIntelligencePanel): IndustryIntelligencePanel {
  return {
    industryOverview: pickKeys(panel.industryOverview, ["industry", "health", "entryDifficulty"]),
    demandIntelligence: pickKeys(panel.demandIntelligence, ["direction", "strength", "topDrivers"]),
    competitiveLandscape: pickKeys(panel.competitiveLandscape, ["threatLevel", "gapOpportunities"]),
    executionReality: pickKeys(panel.executionReality, ["successRequires", "realisticPace"]),
    riskMap: panel.riskMap.slice(0, 2),
    strategicWindows: pickKeys(panel.strategicWindows, ["timing", "leverageTrends"]),
    verdictContext: pickKeys(panel.verdictContext, ["mightWork", "mightFail"]),
  };
}

function pickKeys(obj: Record<string, unknown>, keys: string[]): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined) out[k] = v as string | string[];
  }
  return out;
}

function stripPath(path: FullValidationResult["paths"]["current"]) {
  return {
    ...path,
    scenario: undefined,
    comparisonNote: undefined,
    strengths: path.strengths?.slice(0, 2),
    risks: path.risks?.slice(0, 2),
  };
}
