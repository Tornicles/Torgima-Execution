import type { EdgeMode, InfrastructureInput } from "../contracts/types.js";

export class EdgeEngine {
  route(input: InfrastructureInput): { mode: EdgeMode; caching: boolean; localExecution: boolean } {
    const latency =
      typeof input.traffic?.latencyMs === "number" ? input.traffic.latencyMs : 100;

    let mode: EdgeMode = "GLOBAL";
    if (latency > 300) mode = "REGIONAL";
    if (input.traffic?.edge === true || latency > 800) mode = "LOCAL";

    return {
      mode,
      caching: mode !== "GLOBAL",
      localExecution: mode === "LOCAL",
    };
  }
}

export const edgeEngine = new EdgeEngine();
