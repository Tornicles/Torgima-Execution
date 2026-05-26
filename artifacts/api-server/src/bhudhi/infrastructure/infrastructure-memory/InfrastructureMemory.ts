import type { InfrastructureOutput, MemoryClass } from "../contracts/types.js";

interface Entry {
  output: InfrastructureOutput;
  class: MemoryClass;
  storedAt: string;
}

const store = new Map<string, Entry>();

export class InfrastructureMemory {
  store(blueprintId: string, output: InfrastructureOutput, memoryClass: MemoryClass = "ACTIVE"): void {
    store.set(blueprintId, { output, class: memoryClass, storedAt: new Date().toISOString() });
  }

  get(blueprintId: string): InfrastructureOutput | null {
    const e = store.get(blueprintId);
    if (!e || e.class === "SEALED") return null;
    return e.output;
  }
}

export const infrastructureMemory = new InfrastructureMemory();
