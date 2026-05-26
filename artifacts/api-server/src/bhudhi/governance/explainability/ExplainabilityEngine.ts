import type {
  ExplainabilityRecord,
  GovernanceAction,
  GovernanceActor,
  GovernanceCheckResult,
  PolicyEvaluation,
  RiskAssessment,
} from "../contracts/types.js";

export class ExplainabilityEngine {
  build(params: {
    action: GovernanceAction;
    actor: GovernanceActor;
    policy: PolicyEvaluation;
    risk: RiskAssessment;
    allowed: boolean;
    enforcement: string;
    rejected?: string[];
    assumptions?: string[];
  }): ExplainabilityRecord {
    const decision = params.allowed ? `ALLOW ${params.action}` : `REJECT ${params.action}`;

    const why = params.allowed
      ? `Policy ${params.policy.category} passed with confidence ${params.policy.confidence.toFixed(2)}. Risk: ${params.risk.riskType}.`
      : params.policy.reason ?? params.policy.constraints.join("; ") ?? "Governance blocked action";

    return {
      decision,
      why,
      alternatives: params.rejected ?? [
        params.allowed ? "Proceed with execution" : "Request human approval (L4)",
        "Run simulation first",
        "Defer until signals improve",
      ],
      evidence: [
        ...params.policy.constraints,
        params.risk.recommendation,
        ...(params.assumptions ?? []),
      ],
      confidence: params.policy.confidence,
      agents: params.actor.type === "agent" ? [params.actor.id] : [],
      memoryUsed: [],
      risks: [params.risk.riskType, `score=${params.risk.riskScore.toFixed(2)}`],
      approvals: params.policy.requiredApprovals,
    };
  }

  fromCheckResult(result: GovernanceCheckResult): ExplainabilityRecord {
    return result.explanation;
  }
}

export const explainabilityEngine = new ExplainabilityEngine();
