import type { ReliabilityInput, RollbackMode, RollbackResult, RollbackTarget } from "../contracts/types.js";

export class RollbackEngine {
  rollback(
    input: ReliabilityInput,
    target: RollbackTarget,
    mode: RollbackMode = "SOFT",
  ): RollbackResult {
    const steps = [
      `Snapshot ${target} checkpoint`,
      `Apply ${mode} rollback`,
      "Verify state integrity",
      "Resume with preserved audit trail",
    ];

    if (mode === "SNAPSHOT") {
      steps.unshift("Restore named snapshot");
    }
    if (mode === "HARD") {
      steps.push("Reconcile dependent subsystems");
    }

    return {
      target,
      mode,
      preservedHistory: true,
      status: "complete",
      steps,
    };
  }

  suggestMode(input: ReliabilityInput): RollbackMode {
    if (input.execution?.failed === true) return "HARD";
    if (input.governance?.requiresSnapshot === true) return "SNAPSHOT";
    if (input.execution?.partialFailure === true) return "PARTIAL";
    return "SOFT";
  }
}

export const rollbackEngine = new RollbackEngine();
