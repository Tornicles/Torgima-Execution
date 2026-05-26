import type { AllocationResult, GovernorInput, SystemHealth } from "../contracts/types.js";

export class GovernorOptimization {
  recommend(
    input: GovernorInput,
    health: SystemHealth,
    allocation: AllocationResult,
  ): string[] {
    const recs: string[] = [];

    if (health.coordination < 0.5) {
      recs.push("Improve routing: reduce parallel agent paths");
    }
    if (allocation.waste > 0.1) {
      recs.push("Rebalance allocation: trim simulation budget");
    }
    if (health.drift > 0.3) {
      recs.push("Trigger belief reconciliation before next execution");
    }
    if (typeof input.time?.urgency === "number" && input.time.urgency > 0.8) {
      recs.push("Protect timing window — defer background tasks");
    }
    if (recs.length === 0) {
      recs.push("System within targets — continue measure → recommend → govern loop");
    }

    return recs;
  }
}

export const governorOptimization = new GovernorOptimization();
