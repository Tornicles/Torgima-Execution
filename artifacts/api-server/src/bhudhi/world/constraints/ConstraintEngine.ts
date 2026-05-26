import type { ConstraintResult, WorldInput } from "../contracts/types.js";

export class ConstraintEngine {
  evaluate(input: WorldInput): ConstraintResult {
    const blocked: string[] = [];
    const reasons: string[] = [];

    if (input.signals?.global === "danger") {
      blocked.push("execution");
      reasons.push("Signal layer in danger — reality beats intention");
    }

    if (input.conditions?.blocked === true || input.conditions?.status === "blocked") {
      blocked.push("progress");
      reasons.push("Condition gate blocked");
    }

    if (input.conditions?.governance === "hold") {
      blocked.push("governance");
      reasons.push("Governance hold active");
    }

    const economics = input.conditions?.economics as Record<string, unknown> | undefined;
    if (economics?.blocked) {
      blocked.push("economics");
      reasons.push("Economics constraint");
    }

    const timeBudget = input.conditions?.timeBudget as number | undefined;
    if (typeof timeBudget === "number" && timeBudget <= 0) {
      blocked.push("time");
      reasons.push("No time budget remaining");
    }

    return {
      allowed: blocked.length === 0,
      blocked,
      why: reasons.length ? reasons.join("; ") : "All constraint classes satisfied",
    };
  }
}

export const constraintEngine = new ConstraintEngine();
