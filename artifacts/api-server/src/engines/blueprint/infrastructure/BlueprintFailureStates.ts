import type { BlueprintOperationalState } from "./blueprint-types.js";

export interface FailureStateContract {
  state: BlueprintOperationalState;
  triggerSignals: string[];
  minMomentum?: number;
  maxMomentum?: number;
  dependencyEffect: string;
  adaptationBehavior: string;
  recoveryPath: string;
}

export const BLUEPRINT_FAILURE_STATES: Record<BlueprintOperationalState, FailureStateContract> = {
  ACTIVE: {
    state: "ACTIVE",
    triggerSignals: ["normal progression"],
    dependencyEffect: "dependencies enforced",
    adaptationBehavior: "feedback-driven adjustments within tier rules",
    recoveryPath: "n/a",
  },
  STALLED: {
    state: "STALLED",
    triggerSignals: ["low momentum", "missed targets"],
    maxMomentum: 25,
    dependencyEffect: "downstream phases locked",
    adaptationBehavior: "reduce load, surface blockers",
    recoveryPath: "complete stabilization orders then re-enter ACTIVE",
  },
  DEGRADED: {
    state: "DEGRADED",
    triggerSignals: ["declining completion", "dependency failures"],
    maxMomentum: 40,
    dependencyEffect: "non-critical targets frozen",
    adaptationBehavior: "restrict expansion, increase proof requirements",
    recoveryPath: "repair dependency chain → STALLED → ACTIVE",
  },
  RECOVERY: {
    state: "RECOVERY",
    triggerSignals: ["danger", "nothingness", "post-pause"],
    dependencyEffect: "progression frozen except recovery lane",
    adaptationBehavior: "minimal orders, recovery templates only",
    recoveryPath: "sustain stability signals for 7d → ACTIVE",
  },
  COLLAPSED: {
    state: "COLLAPSED",
    triggerSignals: ["prolonged danger", "zero proof reliability"],
    maxMomentum: 10,
    dependencyEffect: "full chain locked pending strategic review",
    adaptationBehavior: "no expansion; owner review required",
    recoveryPath: "pivot review or tier migration with explicit approval",
  },
  ARCHIVED: {
    state: "ARCHIVED",
    triggerSignals: ["user archived", "blueprint complete"],
    dependencyEffect: "read-only",
    adaptationBehavior: "none",
    recoveryPath: "restore from version history if permitted",
  },
};

export function deriveOperationalState(params: {
  blueprintStatus: string;
  condition: string | null;
  momentum: number;
  completionRate: number;
}): BlueprintOperationalState {
  if (params.blueprintStatus === "complete" || params.blueprintStatus === "abandoned") {
    return "ARCHIVED";
  }
  if (params.blueprintStatus === "paused") return "RECOVERY";
  if (params.condition === "danger" || params.condition === "nothingness") return "RECOVERY";
  if (params.momentum < 10 && params.completionRate < 0.15) return "COLLAPSED";
  if (params.momentum < 25) return "STALLED";
  if (params.completionRate < 0.4 && params.momentum < 45) return "DEGRADED";
  return "ACTIVE";
}
