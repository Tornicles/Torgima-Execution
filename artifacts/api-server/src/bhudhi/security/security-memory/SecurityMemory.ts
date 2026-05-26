import type { MemoryClass, SecurityOutput } from "../contracts/types.js";

interface Entry {
  output: SecurityOutput;
  class: MemoryClass;
  storedAt: string;
}

const store = new Map<string, Entry>();

export class SecurityMemory {
  store(blueprintId: string, output: SecurityOutput, memoryClass: MemoryClass = "ACTIVE"): void {
    store.set(blueprintId, { output, class: memoryClass, storedAt: new Date().toISOString() });
  }

  get(blueprintId: string): SecurityOutput | null {
    const e = store.get(blueprintId);
    if (!e || e.class === "SEALED") return null;
    return e.output;
  }
}

export const securityMemory = new SecurityMemory();
