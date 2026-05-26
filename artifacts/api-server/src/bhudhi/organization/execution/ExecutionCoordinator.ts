import type { CoordinationResult, OrgInput } from "../contracts/types.js";

export class ExecutionCoordinator {
  coordinate(input: OrgInput): CoordinationResult {
    const owners: string[] = [];
    const blocked: string[] = [];
    const actions: string[] = [];

    for (const p of input.projects ?? []) {
      if (p.ownerId) owners.push(p.ownerId);
      else {
        blocked.push(p.name);
        actions.push(`assign:${p.id}`);
      }
    }

    const capacity = (input.execution?.capacity as number) ?? 1;
    const load = (input.projects ?? []).length;
    if (load > capacity * 3) {
      actions.push("rebalance");
      blocked.push("capacity_exceeded");
    }

    if (input.signals?.global === "danger") {
      actions.push("pause");
    } else if (input.strategy?.accelerate) {
      actions.push("accelerate");
    }

    return { owners, blocked, actions };
  }
}

export const executionCoordinator = new ExecutionCoordinator();
