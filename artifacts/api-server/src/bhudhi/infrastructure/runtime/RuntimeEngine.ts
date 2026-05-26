import type { InfrastructureInput, RuntimeResult, RuntimeType } from "../contracts/types.js";

export class RuntimeEngine {
  observe(input: InfrastructureInput): RuntimeResult {
    const pref = input.runtimePreference ?? "cloud";
    const latencyMs =
      typeof input.traffic?.latencyMs === "number"
        ? input.traffic.latencyMs
        : typeof input.execution?.latencyMs === "number"
          ? input.execution.latencyMs
          : 150;
    const throughput =
      typeof input.traffic?.rps === "number" ? input.traffic.rps : 50;
    const errorRate =
      typeof input.execution?.errorRate === "number" ? input.execution.errorRate : 0.02;

    const health = Math.max(0, 1 - errorRate - latencyMs / 60000);
    const stability = health > 0.7 ? 0.85 : health > 0.5 ? 0.6 : 0.35;

    let runtime: RuntimeType = pref;
    if (input.traffic?.edge === true) runtime = "edge";
    if (input.execution?.local === true) runtime = "local";

    let recommendation = "Runtime healthy — continue observe cycle";
    if (health < 0.5) recommendation = "Consider failover or scale up before next deploy";
    if (latencyMs > 500) recommendation = "High latency — enable edge or regional routing";

    return { runtime, health, latencyMs, throughput, stability, recommendation };
  }
}

export const runtimeEngine = new RuntimeEngine();
