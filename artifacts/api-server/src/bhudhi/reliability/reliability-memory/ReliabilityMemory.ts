import type { MemoryClass, ReliabilityOutput } from "../contracts/types.js";

interface Entry {
  output: ReliabilityOutput;
  failures: string[];
  class: MemoryClass;
  storedAt: string;
}

const store = new Map<string, Entry>();

export class ReliabilityMemory {
  store(blueprintId: string, output: ReliabilityOutput, failures: string[] = []): void {
    store.set(blueprintId, {
      output,
      failures,
      class: "ACTIVE",
      storedAt: new Date().toISOString(),
    });
  }

  get(blueprintId: string): ReliabilityOutput | null {
    const e = store.get(blueprintId);
    if (!e || e.class === "SEALED") return null;
    return e.output;
  }

  patterns(blueprintId: string): string[] {
    return store.get(blueprintId)?.failures ?? [];
  }
}

export const reliabilityMemory = new ReliabilityMemory();
