import type { GovernorInput, SystemHealth } from "../contracts/types.js";

export class Supervisor {
  assess(input: GovernorInput, latencyMs = 0): SystemHealth {
    const quality =
      typeof input.execution?.quality === "number"
        ? input.execution.quality
        : typeof input.organization?.healthScore === "number"
          ? input.organization.healthScore / 100
          : 0.65;

    const drift = input.beliefs?.driftDetected === true ? 0.4 : 0.1;
    const coordination =
      typeof input.organization?.alignment === "number" ? input.organization.alignment : 0.6;
    const efficiency =
      input.economics?.blocked === true
        ? 0.35
        : typeof input.economics?.roi === "number"
          ? input.economics.roi
          : 0.7;

    let systemHealth: SystemHealth["systemHealth"] = "stable";
    if (quality < 0.4 || drift > 0.35) systemHealth = "critical";
    else if (quality < 0.6 || coordination < 0.5) systemHealth = "degraded";
    else if (quality > 0.75 && coordination > 0.7) systemHealth = "healthy";

    return {
      quality,
      drift,
      latencyMs,
      coordination,
      efficiency,
      systemHealth,
    };
  }
}

export const supervisor = new Supervisor();
