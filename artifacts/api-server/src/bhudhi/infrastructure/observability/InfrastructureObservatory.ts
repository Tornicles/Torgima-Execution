import type { InfrastructureInput, ObservabilityView } from "../contracts/types.js";

export class InfrastructureObservatory {
  observe(input: InfrastructureInput, runtimeHealth: number): Record<string, unknown> {
    const latency =
      typeof input.traffic?.latencyMs === "number" ? input.traffic.latencyMs : 120;
    const availability = runtimeHealth;
    const load = typeof input.traffic?.load === "number" ? input.traffic.load : 0.4;
    const throughput = typeof input.traffic?.rps === "number" ? input.traffic.rps : 40;
    const errors = typeof input.execution?.errorRate === "number" ? input.execution.errorRate : 0.01;

    return {
      latency,
      availability,
      load,
      throughput,
      errors,
      views: ["live", "hourly", "daily", "historical"] as ObservabilityView[],
    };
  }
}

export const infrastructureObservatory = new InfrastructureObservatory();
