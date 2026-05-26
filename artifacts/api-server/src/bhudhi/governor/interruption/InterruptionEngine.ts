import type { GovernorInput, Intervention, InterruptionAction } from "../contracts/types.js";

export class InterruptionEngine {
  detect(input: GovernorInput): Intervention[] {
    const interventions: Intervention[] = [];

    if (input.identity?.burnout && Number(input.identity.burnout) > 0.7) {
      interventions.push({
        type: "pause",
        subsystem: "execution",
        reason: "Burnout threshold exceeded",
        severity: 0.85,
      });
    }

    if (typeof input.world?.risk === "number" && input.world.risk > 0.75) {
      interventions.push({
        type: "slow",
        subsystem: "agents",
        reason: "Elevated world risk",
        severity: 0.7,
      });
    }

    if (input.economics?.blocked === true) {
      interventions.push({
        type: "freeze",
        subsystem: "economics",
        reason: "Budget limit reached",
        severity: 0.9,
      });
    }

    if (input.beliefs?.driftDetected === true) {
      interventions.push({
        type: "reroute",
        subsystem: "memory",
        reason: "Belief drift — reroute to reconciliation",
        severity: 0.65,
      });
    }

    if (input.execution?.governanceViolation === true) {
      interventions.push({
        type: "freeze",
        subsystem: "execution",
        reason: "Governance violation pending review",
        severity: 1,
      });
    }

    return interventions;
  }

  shouldBlock(interventions: Intervention[]): boolean {
    return interventions.some((i) => i.severity >= 0.9 && (i.type === "freeze" || i.type === "pause"));
  }
}

export const interruptionEngine = new InterruptionEngine();
