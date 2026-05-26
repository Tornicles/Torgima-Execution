import type { MemoryClass, TemporalOutput } from "../contracts/types.js";

const cache = new Map<string, TemporalOutput>();

export class TemporalMemory {
  store(blueprintId: string, output: TemporalOutput, memoryClass: MemoryClass = "ACTIVE"): void {
    cache.set(blueprintId, { ...output, timeState: { ...output.timeState } });
    void memoryClass;
  }

  get(blueprintId: string): TemporalOutput | null {
    return cache.get(blueprintId) ?? null;
  }
}

export const temporalMemory = new TemporalMemory();
