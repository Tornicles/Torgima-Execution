import type { DeploymentPlan, DeploymentStrategy, InfrastructureInput } from "../contracts/types.js";

export class DeploymentEngine {
  plan(input: InfrastructureInput, risk: number): DeploymentPlan {
    let strategy: DeploymentStrategy = "rolling";
    if (risk > 0.7) strategy = "canary";
    else if (risk < 0.3) strategy = "blue";
    if (input.execution?.shadow === true) strategy = "shadow";

    const steps = [
      `Prepare ${strategy} deployment`,
      "Snapshot rollback point",
      "Deploy to target environment",
      "Health check gate",
      strategy === "canary" ? "Gradual traffic shift" : "Promote or rollback",
    ];

    return {
      strategy,
      rollbackAvailable: true,
      steps,
      recommendation: "No deployment without rollback — snapshot preserved",
    };
  }

  canPromote(plan: DeploymentPlan): boolean {
    return plan.rollbackAvailable;
  }
}

export const deploymentEngine = new DeploymentEngine();
