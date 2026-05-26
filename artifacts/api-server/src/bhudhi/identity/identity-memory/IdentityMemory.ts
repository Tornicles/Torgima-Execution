import type { IdentityOutput, MemoryClass } from "../contracts/types.js";

const cache = new Map<string, { output: IdentityOutput; memoryClass: MemoryClass }>();

export class IdentityMemory {
  store(blueprintId: string, output: IdentityOutput, memoryClass: MemoryClass = "ACTIVE"): void {
    cache.set(blueprintId, { output, memoryClass });
  }

  get(blueprintId: string): IdentityOutput | null {
    const entry = cache.get(blueprintId);
    return entry?.output ?? null;
  }

  archive(blueprintId: string): void {
    const entry = cache.get(blueprintId);
    if (entry) cache.set(blueprintId, { ...entry, memoryClass: "ARCHIVE" });
  }
}

export const identityMemory = new IdentityMemory();
