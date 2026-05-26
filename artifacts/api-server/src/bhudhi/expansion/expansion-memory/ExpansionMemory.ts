import type { DiscoveredCapability, ExpansionOutput } from "../contracts/types.js";

interface Entry {
  output: ExpansionOutput;
  rejected: DiscoveredCapability[];
}

const byBlueprint = new Map<string, Entry[]>();
const promoted = new Map<string, DiscoveredCapability[]>();

export class ExpansionMemory {
  store(blueprintId: string, output: ExpansionOutput, rejected: DiscoveredCapability[] = []): void {
    const list = byBlueprint.get(blueprintId) ?? [];
    list.push({ output, rejected });
    byBlueprint.set(blueprintId, list.slice(-30));

    if (output.approval) {
      const p = promoted.get(blueprintId) ?? [];
      promoted.set(blueprintId, [...p, ...output.newCapabilities].slice(-20));
    }
  }

  getPromoted(blueprintId: string): DiscoveredCapability[] {
    return promoted.get(blueprintId) ?? [];
  }

  list(blueprintId: string): ExpansionOutput[] {
    return (byBlueprint.get(blueprintId) ?? []).map((e) => e.output);
  }
}

export const expansionMemory = new ExpansionMemory();
