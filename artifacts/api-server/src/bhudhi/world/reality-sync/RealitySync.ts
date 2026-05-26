import type { WorldInput } from "../contracts/types.js";

export interface SyncResult {
  mode: "live" | "scheduled" | "manual";
  drift: boolean;
  stale: boolean;
  conflicts: number;
  sources: string[];
}

export class RealitySync {
  sync(input: WorldInput, mode: SyncResult["mode"] = "live"): SyncResult {
    const sources: string[] = [];
    if (input.memory) sources.push("memory");
    if (input.life) sources.push("life");
    if (input.feedback) sources.push("feedback");
    if (input.execution) sources.push("execution");
    if (input.simulation) sources.push("simulation");

    let conflicts = 0;
    if (input.signals?.global === "danger" && input.feedback?.positive === true) {
      conflicts += 1;
    }
    if (input.simulation && input.execution?.status === "completed") {
      conflicts += 1;
    }

    const memStale =
      typeof input.memory === "string" &&
      input.memory.includes("stale");
    const signalStale = input.conditions?.stale === true;

    return {
      mode,
      drift: conflicts > 0 || memStale,
      stale: memStale || signalStale,
      conflicts,
      sources,
    };
  }
}

export const realitySync = new RealitySync();
