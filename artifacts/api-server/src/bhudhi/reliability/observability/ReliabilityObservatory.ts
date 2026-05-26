import type { ObservatorySnapshot, ReliabilityInput, RetentionWindow } from "../contracts/types.js";

export class ReliabilityObservatory {
  observe(input: ReliabilityInput, incidentCount: number, rollbackCount: number): ObservatorySnapshot {
    const latencyMs =
      typeof input.execution?.latencyMs === "number" ? input.execution.latencyMs : 120;
    const availability =
      typeof input.execution?.uptime === "number" ? input.execution.uptime : 0.99;
    const drift =
      input.memory && typeof input.memory === "object" && input.memory.driftDetected === true
        ? 0.35
        : 0.05;
    const errorRate =
      typeof input.execution?.errorRate === "number" ? input.execution.errorRate : 0.02;

    const retention: RetentionWindow = "30d";

    return {
      latencyMs,
      incidentCount,
      availability,
      drift,
      rollbackCount,
      errorRate,
      retention,
    };
  }

  retentionWindows(): RetentionWindow[] {
    return ["7d", "30d", "90d", "1y"];
  }
}

export const reliabilityObservatory = new ReliabilityObservatory();
