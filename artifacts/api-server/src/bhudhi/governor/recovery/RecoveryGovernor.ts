import type { GovernorInput, RecoveryMode, RecoveryResult } from "../contracts/types.js";

const TARGETS = ["execution", "memory", "simulation", "identity", "organization"] as const;

export class RecoveryGovernor {
  recover(
    input: GovernorInput,
    target: (typeof TARGETS)[number],
    mode: RecoveryMode = "adaptive",
  ): RecoveryResult {
    const steps: string[] = [
      `Snapshot ${target} state (history preserved)`,
      `Apply ${mode} recovery protocol`,
      "Validate subsystem health",
      "Resume coordinated execution",
    ];

    if (mode === "rollback") {
      steps.unshift("Restore last known-good checkpoint");
    }
    if (mode === "full") {
      steps.push("Reconcile all dependent subsystems");
    }

    const severity =
      typeof input.identity?.burnout === "number" ? input.identity.burnout : 0.3;

    return {
      mode: severity > 0.8 ? "soft" : mode,
      target,
      status: "pending",
      preservedHistory: true,
      steps,
    };
  }

  suggestMode(input: GovernorInput): RecoveryMode {
    if (input.execution?.failed === true) return "rollback";
    if (input.identity?.burnout && Number(input.identity.burnout) > 0.6) return "soft";
    if (input.organization?.healthAction === "escalate") return "adaptive";
    return "adaptive";
  }
}

export const recoveryGovernor = new RecoveryGovernor();
