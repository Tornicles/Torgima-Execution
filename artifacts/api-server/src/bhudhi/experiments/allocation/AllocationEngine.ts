import type { AllocationMethod, ExperimentGroup } from "../contracts/types.js";

export class AllocationEngine {
  allocate(
    groups: ExperimentGroup[],
    method: AllocationMethod = "weighted",
    protectedKeys: string[] = [],
  ): Record<string, number> {
    const eligible = groups.filter((g) => !protectedKeys.includes(g.groupKey));
    if (eligible.length === 0) return {};

    const total = eligible.reduce((s, g) => s + g.allocationWeight, 0);
    const out: Record<string, number> = {};

    if (method === "random") {
      const pick = eligible[Math.floor(Math.random() * eligible.length)]!;
      out[pick.groupKey] = 1;
      return out;
    }

    for (const g of eligible) {
      out[g.groupKey] = g.allocationWeight / total;
    }
    return out;
  }

  /** Protected values never enter experiments. */
  filterProtected(groups: ExperimentGroup[], protectedValues: string[]): ExperimentGroup[] {
    if (protectedValues.length === 0) return groups;
    return groups.filter((g) => g.groupKey === "control" || !protectedValues.some((p) => g.label.includes(p)));
  }
}

export const allocationEngine = new AllocationEngine();
