import type { MemoryClass, OrgOutput } from "../contracts/types.js";

const cache = new Map<string, { output: OrgOutput; memoryClass: MemoryClass }>();

export class OrganizationMemory {
  store(blueprintId: string, output: OrgOutput, memoryClass: MemoryClass = "ACTIVE"): void {
    cache.set(blueprintId, { output, memoryClass });
  }

  get(blueprintId: string): OrgOutput | null {
    return cache.get(blueprintId)?.output ?? null;
  }
}

export const organizationMemory = new OrganizationMemory();
