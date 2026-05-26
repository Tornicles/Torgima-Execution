import type { GovernorInput, OrchestratorAction } from "../contracts/types.js";
import type { PriorityMap } from "../contracts/types.js";
import type { Intervention } from "../contracts/types.js";

const SUBSYSTEMS = ["memory", "simulation", "agents", "economics", "execution", "dashboard"] as const;

export class SystemOrchestrator {
  coordinate(
    input: GovernorInput,
    priorityMap: PriorityMap,
    interventions: Intervention[],
  ): Record<string, OrchestratorAction> {
    const state: Record<string, OrchestratorAction> = {};

    for (const sub of SUBSYSTEMS) {
      const entry = priorityMap.entries.find((e) => e.subsystem === sub);
      const interrupted = interventions.some((i) => i.subsystem === sub);

      if (interrupted) {
        state[sub] = interventions.find((i) => i.subsystem === sub)?.type === "pause" ? "pause" : "queue";
      } else if (entry?.priority === "CRITICAL" || entry?.priority === "HIGH") {
        state[sub] = "activate";
      } else if (entry?.priority === "BACKGROUND") {
        state[sub] = "queue";
      } else {
        state[sub] = input.execution?.status === "running" ? "resume" : "activate";
      }
    }

    if (input.economics?.blocked === true) {
      state.simulation = "terminate";
      state.agents = "pause";
    }

    return state;
  }
}

export const systemOrchestrator = new SystemOrchestrator();
