import type { InfrastructureInput, ScaleResult, ScalingMode } from "../contracts/types.js";

export class ScalingEngine {
  forecast(input: InfrastructureInput, utilization: number): ScaleResult {
    const users = typeof input.traffic?.users === "number" ? input.traffic.users : 100;
    const load = typeof input.traffic?.load === "number" ? input.traffic.load : utilization;

    let mode: ScalingMode = "AUTO";
    if (input.governor?.priority === "CRITICAL") mode = "GOVERNED";
    if (input.execution?.manualScale === true) mode = "MANUAL";
    if (load > 0.75) mode = "PREDICTIVE";

    const scale = Math.max(1, Math.ceil(users / 50) * (load > 0.8 ? 2 : 1));
    const forecast = Math.ceil(scale * (1 + load * 0.5));
    const cost =
      typeof input.economics?.estimatedCost === "number"
        ? input.economics.estimatedCost * scale
        : scale * 0.05;

    return { scale, forecast, cost, mode };
  }
}

export const scalingEngine = new ScalingEngine();
