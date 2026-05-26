import type { AllocationResult, GovernorInput, PriorityMap } from "../contracts/types.js";

export class AllocationGovernor {
  allocate(input: GovernorInput, priorityMap: PriorityMap): AllocationResult {
    const total = 100;
    const entries = priorityMap.entries;
    const sumScores = entries.reduce((s, e) => s + e.score, 0) || 1;

    const allocation: Record<string, number> = {};
    for (const e of entries) {
      allocation[e.subsystem] = Math.round((e.score / sumScores) * total);
    }

    allocation.compute = allocation.compute ?? Math.round(total * 0.2);
    allocation.time = allocation.time ?? Math.round(total * 0.2);
    allocation.memory = allocation.memory ?? Math.round(total * 0.15);
    allocation.agents = allocation.agents ?? Math.round(total * 0.2);
    allocation.simulation = allocation.simulation ?? Math.round(total * 0.15);

    const allocatedSum = Object.values(allocation).reduce((a, b) => a + b, 0);
    const waste = Math.max(0, allocatedSum - total) / 100;

    const economicsBlocked = input.economics?.blocked === true;
    let recommendation = "Resources follow priority map — no reallocation needed";
    if (waste > 0.15) {
      recommendation = "Reduce simulation allocation — waste detected";
    } else if (economicsBlocked) {
      recommendation = "Throttle compute and agents until budget recovers";
    } else if (priorityMap.topPriority.priority === "CRITICAL") {
      recommendation = `Protect ${priorityMap.topPriority.subsystem} — critical priority`;
    }

    return { allocation, waste, recommendation };
  }
}

export const allocationGovernor = new AllocationGovernor();
