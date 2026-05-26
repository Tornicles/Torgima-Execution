import type { InfrastructureInput, RecoveryResult } from "../contracts/types.js";

export class InfrastructureRecovery {
  recover(
    input: InfrastructureInput,
    target: "runtime" | "deployment" | "storage" | "network",
  ): RecoveryResult {
    const failed = input.execution?.infraFailed === true;

    let action: RecoveryResult["action"] = "reroute";
    if (target === "deployment") action = "rollback";
    if (target === "storage" && failed) action = "rebuild";
    if (target === "network") action = "failover";

    const steps = [
      `Assess ${target} health`,
      `Execute ${action}`,
      "Verify observability gates",
      "Resume governed execution",
    ];

    return { action, target, steps };
  }
}

export const infrastructureRecovery = new InfrastructureRecovery();
