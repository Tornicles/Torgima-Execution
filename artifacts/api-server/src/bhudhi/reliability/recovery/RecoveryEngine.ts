import type { DetectedIncident, RecoveryOutput, ReliabilityInput } from "../contracts/types.js";

const TARGETS = ["execution", "agents", "memory", "simulation", "coordination"] as const;

export class RecoveryEngine {
  recover(input: ReliabilityInput, incidents: DetectedIncident[]): RecoveryOutput {
    const critical = incidents.some((i) => i.severity === "CRITICAL" || i.severity === "SYSTEM");
    const strategy = critical ? "full_restart_with_checkpoint" : "adaptive_restore";

    const confidence = critical ? 0.65 : 0.85;
    const estimatedRecovery = critical ? 15 : 5;

    const steps = TARGETS.map((t) => `Recover ${t}`);

    return {
      strategy,
      confidence,
      estimatedRecovery,
      ...({ steps } as { steps?: string[] }),
    };
  }
}

export const recoveryEngine = new RecoveryEngine();
