import type { ChaosMode, ReliabilityInput } from "../contracts/types.js";

export type ChaosFault = "latency" | "memory_loss" | "simulation_crash" | "agent_failure" | "api_outage" | "network_partition";

export class ChaosEngine {
  canRun(input: ReliabilityInput): boolean {
    const mode = input.chaosMode ?? "DISABLED";
    if (mode === "DISABLED") return false;
    if (mode === "SAFE") return true;
    if (mode === "LAB" || mode === "STAGING") {
      return input.governanceApproved === true;
    }
    return false;
  }

  inject(
    fault: ChaosFault,
    input: ReliabilityInput,
  ): { allowed: boolean; simulated: boolean; detail: string } {
    if (!this.canRun(input)) {
      return {
        allowed: false,
        simulated: false,
        detail: "Chaos disabled or requires governance approval for LAB/STAGING",
      };
    }

    return {
      allowed: true,
      simulated: true,
      detail: `Controlled ${fault} injected in ${input.chaosMode ?? "SAFE"} mode`,
    };
  }

  supported(): ChaosFault[] {
    return ["latency", "memory_loss", "simulation_crash", "agent_failure", "api_outage", "network_partition"];
  }
}

export const chaosEngine = new ChaosEngine();
