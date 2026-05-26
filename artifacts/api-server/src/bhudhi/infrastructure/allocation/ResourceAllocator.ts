import type { AllocationResult, InfrastructureInput } from "../contracts/types.js";

export class ResourceAllocator {
  allocate(input: InfrastructureInput, priorityWeight = 1): AllocationResult {
    const load = typeof input.traffic?.load === "number" ? input.traffic.load : 0.45;
    const base = 100 * priorityWeight;

    const allocated = {
      cpu: Math.round(base * 0.25 * (1 + load)),
      memory: Math.round(base * 0.25 * (1 + load * 0.5)),
      gpu: Math.round(base * 0.15),
      storage: Math.round(base * 0.2),
      network: Math.round(base * 0.15 * (1 + load)),
    };

    const sum = Object.values(allocated).reduce((a, b) => a + b, 0);
    const utilization = Math.min(1, load + 0.1);
    const waste = Math.max(0, (sum - base) / base);

    return { allocated, utilization, waste };
  }

  capacityFromAllocation(alloc: AllocationResult): { total: number; available: number; utilization: number; canSupport: boolean } {
    const total = Object.values(alloc.allocated).reduce((a, b) => a + b, 0);
    const available = Math.round(total * (1 - alloc.utilization));
    return {
      total,
      available,
      utilization: alloc.utilization,
      canSupport: alloc.utilization < 0.9,
    };
  }
}

export const resourceAllocator = new ResourceAllocator();
