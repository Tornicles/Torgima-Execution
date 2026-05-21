import type {
  ArchetypeResolutionOutput,
  ErectorScores,
  ErectorValidationInput,
  TimeSimulationOutput,
  ValidationPathOutput,
} from "../../types/erector.js";
import { callErectorTrigger } from "./ErectorIntelligenceBridge.js";

function deterministicSimulations(input: ErectorValidationInput, scores: ErectorScores): TimeSimulationOutput[] {
  const base = scores.realityScore >= 7 ? 0.72 : scores.realityScore >= 4 ? 0.48 : 0.24;
  return ["30d", "90d", "6m", "1yr"].map((timeframe, index) => ({
    timeframe,
    dailyTaskCount: { min: 1 + index, max: 2 + index * 2, average: 1.5 + index },
    weeklyOutputRequirements: ["Produce proof assets", "Validate demand signal", "Submit execution feedback"],
    estimatedRevenueTimeline:
      timeframe === "30d" ? "Validation, not dependable revenue." : "Possible after repeated proof and conversion tests.",
    requiredCapitalBurn: Math.round(input.budgetAvailable * (0.15 + index * 0.1)),
    executionIntensityLabel: index === 0 ? "very_high" : index === 1 ? "high" : "moderate",
    probabilityOfReachingGoal: Number(Math.max(0.05, Math.min(0.9, base + index * 0.07)).toFixed(2)),
    majorRiskPoints: ["Weak proof", "Distribution lag", "Budget/time mismatch"],
    criticalSuccessFactors: ["Narrow segment", "Visible proof", "Weekly adaptation"],
  }));
}

function pathFromType(
  pathType: ValidationPathOutput["pathType"],
  scores: ErectorScores,
  patch?: Partial<ValidationPathOutput>,
): ValidationPathOutput & Record<string, unknown> {
  const adjusted = pathType === "adjusted";
  const alternative = pathType === "alternative";
  const disabled = scores.verdict === "pivot" && pathType === "current";
  const probability = Math.max(0.05, Math.min(0.85, scores.realityScore / 10 + (adjusted ? 0.12 : alternative ? 0.18 : 0)));
  const title = alternative ? "Alternative Path" : adjusted ? "Adjusted Path" : "Current Path";
  return {
    pathType,
    type: pathType,
    title,
    summary: alternative ? "Pivot the first market or model." : adjusted ? "Modify scope before blueprint launch." : "Proceed with current assumptions.",
    rationale: "Path generated from economy-adjusted validation scores.",
    description:
      alternative ? "Change the execution wedge before launch."
      : adjusted ? "Keep the goal but reduce scope and increase proof cadence."
      : "Execute the stated goal under current assumptions.",
    modifications: adjusted
      ? ["Narrow target customer", "Extend timeline", "Increase proof cadence"]
      : alternative
        ? ["Change wedge", "Lower capital exposure", "Validate demand first"]
        : [],
    expectedDifficulty: scores.blueprintDifficultyScore >= 7 ? "high" : "moderate",
    probabilityOfSuccess: Number(probability.toFixed(2)),
    timelineAdjustment: adjusted ? "Add 30-60 days of validation time." : alternative ? "Restart with lower-risk wedge." : "Base timeframe retained.",
    blueprintLevelRecommendation: scores.recommendedBlueprintLevel,
    keyRisks: ["Demand uncertainty", "Execution consistency", "Trust-building delay"],
    keyAdvantages: adjusted ? ["Lower risk", "Clearer market proof"] : alternative ? ["Avoids weakest assumptions"] : ["Fastest start"],
    firstWeekActionsPreview: ["Define proof target", "Interview customer segment", "Ship first visible artifact"],
    disabled,
    disabledReason: disabled ? "Reality Score below 4.0. Current path cannot launch." : undefined,
    ...patch,
  };
}

export async function buildTimeSimulations(
  input: ErectorValidationInput,
  archetype: ArchetypeResolutionOutput,
  scores: ErectorScores,
  validationId: string,
): Promise<TimeSimulationOutput[]> {
  const result = await callErectorTrigger("ERECTOR_SIMULATE_TIMEFRAMES", {
    input,
    archetype,
    validationId,
    extraFacts: { scores, timeframe: input.timeframe },
  });
  const simulations = result.data["simulations"];
  if (Array.isArray(simulations) && simulations.length > 0) {
    return simulations as TimeSimulationOutput[];
  }
  return deterministicSimulations(input, scores);
}

export async function generatePaths(
  input: ErectorValidationInput,
  archetype: ArchetypeResolutionOutput,
  scores: ErectorScores,
  simulations: TimeSimulationOutput[],
  validationId: string,
): Promise<{
  current: ValidationPathOutput & Record<string, unknown>;
  adjusted: ValidationPathOutput & Record<string, unknown>;
  alternative: ValidationPathOutput & Record<string, unknown>;
}> {
  const baseline = {
    current: pathFromType("current", scores),
    adjusted: pathFromType("adjusted", scores),
    alternative: pathFromType("alternative", scores),
  };
  const result = await callErectorTrigger("ERECTOR_PATHS_GENERATE", {
    input,
    archetype,
    validationId,
    extraFacts: { scores, simulations, verdict: scores.verdict },
  });
  const paths = result.data["paths"] as Record<string, Record<string, unknown>> | undefined;
  if (!paths || typeof paths !== "object") return baseline;
  return {
    current: pathFromType("current", scores, paths.current as Partial<ValidationPathOutput>),
    adjusted: pathFromType("adjusted", scores, paths.adjusted as Partial<ValidationPathOutput>),
    alternative: pathFromType("alternative", scores, paths.alternative as Partial<ValidationPathOutput>),
  };
}

export async function generateFirstWeek(
  input: ErectorValidationInput,
  archetype: ArchetypeResolutionOutput,
  validationId: string,
  selectedPath: "current" | "adjusted" | "alternative",
): Promise<{ days: Array<{ day: number; actions: Array<{ title: string; description: string; type: string; economyContext: string }> }> }> {
  const result = await callErectorTrigger("ERECTOR_FIRST_WEEK", {
    input,
    archetype,
    validationId,
    extraFacts: { selectedPath },
  });
  const actions = result.data["actions"];
  if (Array.isArray(actions) && actions.length >= 3) {
    const perDay = Math.max(1, Math.ceil(actions.length / 7));
    return {
      days: Array.from({ length: 7 }, (_, index) => ({
        day: index + 1,
        actions: (actions as string[]).slice(index * perDay, index * perDay + perDay).map((title) => ({
          title,
          description: "Produce one verifiable output tied to the selected path.",
          type: "execution",
          economyContext: archetype.primaryArchetype.name,
        })),
      })),
    };
  }
  return {
    days: Array.from({ length: 7 }, (_, index) => ({
      day: index + 1,
      actions: [
        {
          title: index === 0 ? "Define proof target" : `Execute validation proof ${index + 1}`,
          description: "Produce one verifiable output tied to the selected path.",
          type: "execution",
          economyContext: archetype.economySpecificOpportunities[0] ?? archetype.primaryArchetype.name,
        },
      ],
    })),
  };
}
