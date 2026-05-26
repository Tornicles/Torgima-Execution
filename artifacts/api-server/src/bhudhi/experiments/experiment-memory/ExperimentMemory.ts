import type { ExperimentCreateResult, MemoryClass } from "../contracts/types.js";

const activeByBlueprint = new Map<string, string>();
const cache = new Map<string, ExperimentCreateResult>();

export class ExperimentMemory {
  setActive(blueprintId: string, experimentId: string): void {
    activeByBlueprint.set(blueprintId, experimentId);
  }

  getActive(blueprintId: string): string | null {
    return activeByBlueprint.get(blueprintId) ?? null;
  }

  hasOverlapping(blueprintId: string): boolean {
    const id = activeByBlueprint.get(blueprintId);
    return Boolean(id);
  }

  clearActive(blueprintId: string): void {
    activeByBlueprint.delete(blueprintId);
  }

  store(experimentId: string, result: ExperimentCreateResult, memoryClass: MemoryClass = "ACTIVE"): void {
    cache.set(experimentId, result);
    void memoryClass;
  }

  get(experimentId: string): ExperimentCreateResult | null {
    return cache.get(experimentId) ?? null;
  }
}

export const experimentMemory = new ExperimentMemory();
