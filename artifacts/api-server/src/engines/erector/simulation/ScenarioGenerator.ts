import type { ArchetypeRulePack } from "../economic/types.js";
import type { RealityProfileRow } from "../types/verdict-types.js";
import type { ScenarioBundle, SimulationScores } from "./types.js";

function defaultFailureModes(rulePack: ArchetypeRulePack): string[] {
  if (rulePack.common_failure_modes?.length) return rulePack.common_failure_modes;
  return [rulePack.core_risk];
}

export function generateScenarios(
  scores: SimulationScores,
  profile: RealityProfileRow,
  rulePack: ArchetypeRulePack,
): ScenarioBundle {
  const hours = profile.hours_per_week ?? 0;
  const executionNote =
    hours >= 4
      ? `execution >= ${hours}hr/week as stated`
      : "execution at stated weekly hours";

  return {
    best_case: {
      description:
        "All major assumptions hold, customer executes consistently, market responds well, and no major blockers emerge.",
      probability: scores.probability_proceed,
      timeline_adj: "15–25% faster than stated timeline",
      conditions: [
        `demand proof class maintained at or above tier minimum`,
        executionNote,
        "no major competitor move",
        "first customer acquired within 30 days",
      ],
      risks: [`${rulePack.archetype_name} upside depends on ${rulePack.core_risk}`],
      warning_triggers: [
        "execution drops below 4hr/week for 2+ consecutive weeks",
        "first customer not acquired within 60 days",
        "core assumption invalidated by market data",
      ],
    },
    base_case: {
      description:
        "Some friction emerges, some assumptions hold, and execution proceeds at a reasonable pace with at least one mid-course adjustment.",
      probability: scores.probability_adjust,
      timeline_adj: "stated timeline +20% to +35%",
      risks: [
        "capability gaps slow delivery",
        "demand builds slower than expected",
        "resource strain under stated budget",
      ],
      blockers: defaultFailureModes(rulePack).slice(0, 3),
    },
    downside: {
      description:
        "Key assumptions are challenged, execution is inconsistent, and the market responds slower than planned.",
      probability: scores.probability_failure,
      timeline_adj: "stated timeline +60% or goal not achieved",
      failure_modes: defaultFailureModes(rulePack),
      correction_path: `Address ${rulePack.core_risk} by collecting stronger proof, reducing scope, or pivoting to a lower-friction offer.`,
    },
  };
}
