import type { GovernanceAction, GovernanceContext, RiskAssessment, RiskLevel } from "../contracts/types.js";
import { capabilityRegistry } from "../capability-engine/CapabilityRegistry.js";

function riskFromCapability(action: GovernanceAction): number {
  const cap = capabilityRegistry.get(action);
  const base: Record<string, number> = {
    LOW: 0.15,
    MEDIUM: 0.4,
    HIGH: 0.65,
    CRITICAL: 0.85,
    FORBIDDEN: 1,
  };
  return base[cap?.risk ?? "MEDIUM"] ?? 0.5;
}

function levelFromScore(score: number): RiskLevel {
  if (score >= 0.9) return "LOCK";
  if (score >= 0.75) return "CRITICAL";
  if (score >= 0.55) return "HIGH";
  if (score >= 0.35) return "CAUTION";
  return "SAFE";
}

export class RiskGovernor {
  assess(action: GovernanceAction, context: GovernanceContext = {}): RiskAssessment {
    let riskScore = riskFromCapability(action);

    if (context.globalSignal === "danger") riskScore += 0.2;
    if (context.globalSignal === "urgency") riskScore += 0.1;
    if ((context.confidence ?? 0.5) < 0.45) riskScore += 0.15;
    if ((context.costEstimate ?? 0) > 10000) riskScore += 0.1;
    if ((context.trustScore ?? 0.7) < 0.4) riskScore += 0.2;

    riskScore = Math.min(1, Math.max(0, riskScore));
    const riskType = levelFromScore(riskScore);

    const requiresApproval = riskType !== "SAFE" || action === "EXECUTE_WORKFLOW";

    const recommendation =
      riskType === "LOCK"
        ? "Block execution — activate emergency review"
        : riskType === "CRITICAL"
          ? "Require L4 human approval before proceeding"
          : riskType === "HIGH"
            ? "Require L2+ approval and simulation"
            : riskType === "CAUTION"
              ? "Proceed with monitoring"
              : "Within safe operating bounds";

    return { riskScore, riskType, recommendation, requiresApproval };
  }
}

export const riskGovernor = new RiskGovernor();
