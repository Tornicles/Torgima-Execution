import type { ErectorOutput, MemoryClass } from "../contracts/types.js";

interface Entry {
  output: ErectorOutput;
  seed: string;
  class: MemoryClass;
}

const byBlueprint = new Map<string, Entry[]>();
const bySimulation = new Map<string, ErectorOutput>();

export class SimulationMemory {
  store(blueprintId: string, output: ErectorOutput, seed: string): void {
    bySimulation.set(output.simulationId, output);
    const list = byBlueprint.get(blueprintId) ?? [];
    list.push({ output, seed, class: "ACTIVE" });
    byBlueprint.set(blueprintId, list.slice(-20));
  }

  get(simulationId: string): ErectorOutput | null {
    return bySimulation.get(simulationId) ?? null;
  }

  replay(simulationId: string): { seed: string; output: ErectorOutput } | null {
    const output = bySimulation.get(simulationId);
    if (!output) return null;
    const entry = [...byBlueprint.values()]
      .flat()
      .find((e) => e.output.simulationId === simulationId);
    return entry ? { seed: entry.seed, output } : { seed: output.simulationId, output };
  }

  list(blueprintId: string): ErectorOutput[] {
    return (byBlueprint.get(blueprintId) ?? []).map((e) => e.output);
  }
}

export const simulationMemory = new SimulationMemory();
