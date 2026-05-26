import type { GovernorOutput, MemoryClass } from "../contracts/types.js";

interface MemoryEntry {
  output: GovernorOutput;
  class: MemoryClass;
  storedAt: string;
}

const store = new Map<string, MemoryEntry>();

export class GovernorMemory {
  store(blueprintId: string, output: GovernorOutput, memoryClass: MemoryClass = "ACTIVE"): void {
    store.set(blueprintId, {
      output,
      class: memoryClass,
      storedAt: new Date().toISOString(),
    });
  }

  get(blueprintId: string): GovernorOutput | null {
    const entry = store.get(blueprintId);
    if (!entry || entry.class === "SEALED") return null;
    return entry.output;
  }

  archive(blueprintId: string): void {
    const entry = store.get(blueprintId);
    if (entry) entry.class = "ARCHIVE";
  }
}

export const governorMemory = new GovernorMemory();
