import type {
  EnforcementAction,
  GovernanceAction,
  PolicyEvaluation,
  RiskAssessment,
} from "../contracts/types.js";

export class GovernanceEnforcer {
  decide(
    policy: PolicyEvaluation,
    risk: RiskAssessment,
    action: GovernanceAction,
  ): EnforcementAction {
    if (!policy.allowed || risk.riskType === "LOCK") return "REJECT";
    if (risk.riskType === "CRITICAL") return "ESCALATE";
    if (risk.riskType === "HIGH" && action === "EXECUTE_WORKFLOW") return "ESCALATE";
    if (risk.riskType === "CAUTION") return "THROTTLE";
    if (action === "RUN_SIMULATION" || policy.constraints.some((c) => c.includes("Simulation"))) {
      return "SIMULATE";
    }
    return "ALLOW";
  }
}

export const governanceEnforcer = new GovernanceEnforcer();
