import type {
  GovernanceActor,
  GovernanceAction,
  GovernanceContext,
  PolicyCategory,
  PolicyEvaluation,
  ApprovalLevel,
} from "../contracts/types.js";
import { isForbiddenAction } from "../contracts/immutableRules.js";
import { capabilityRegistry } from "../capability-engine/CapabilityRegistry.js";

function categoryForAction(action: GovernanceAction): PolicyCategory {
  const map: Partial<Record<GovernanceAction, PolicyCategory>> = {
    READ_MEMORY: "MEMORY_POLICY",
    MEMORY_WRITE: "MEMORY_POLICY",
    RUN_SIMULATION: "SIMULATION_POLICY",
    EXECUTE_WORKFLOW: "EXECUTION_POLICY",
    LEARNING_UPDATE: "LEARNING_POLICY",
    DEPLOY_SYSTEM: "UPGRADE_POLICY",
    AGENT_SPAWN: "SYSTEM_POLICY",
    CREATE_TASKS: "EXECUTION_POLICY",
    GENERATE_PLAN: "EXECUTION_POLICY",
  };
  return map[action] ?? "SECURITY_POLICY";
}

const MIN_CONFIDENCE: Partial<Record<GovernanceAction, number>> = {
  EXECUTE_WORKFLOW: 0.45,
  DEPLOY_SYSTEM: 0.75,
  RUN_SIMULATION: 0.4,
};

export class PolicyEngine {
  evaluatePolicy(
    actor: GovernanceActor,
    action: GovernanceAction,
    context: GovernanceContext = {},
  ): PolicyEvaluation {
    const constraints: string[] = [];
    const requiredApprovals: ApprovalLevel[] = [];

    if (isForbiddenAction(action)) {
      return {
        allowed: false,
        confidence: 0,
        requiredApprovals: ["L5"],
        constraints: ["Constitutional violation — action forbidden"],
        category: "SECURITY_POLICY",
        reason: `${action} violates immutable system laws`,
      };
    }

    if (actor.type === "bhudhi" && action === "SELF_APPROVE") {
      return {
        allowed: false,
        confidence: 0,
        requiredApprovals: ["L4"],
        constraints: ["Bhudhi cannot self-approve"],
        category: "SECURITY_POLICY",
        reason: "Bhudhi may never govern itself",
      };
    }

    const capAuth = capabilityRegistry.authorize(action);
    if (!capAuth.authorized || !capAuth.capability) {
      return {
        allowed: false,
        confidence: 0,
        requiredApprovals: ["L5"],
        constraints: capAuth.reason ? [capAuth.reason] : [],
        category: categoryForAction(action),
        reason: capAuth.reason,
      };
    }

    requiredApprovals.push(capAuth.capability.requiresApproval);

    const minConf = MIN_CONFIDENCE[action] ?? 0.3;
    const confidence = context.confidence ?? 0.5;

    if (confidence < minConf) {
      constraints.push(`Confidence ${confidence.toFixed(2)} below required ${minConf}`);
    }

    if (context.globalSignal === "danger" && action === "EXECUTE_WORKFLOW") {
      constraints.push("Global danger signal — execution throttled");
      requiredApprovals.push("L3");
    }

    if (capAuth.capability.requiresSimulation && !context.simulationRequired) {
      constraints.push("Simulation recommended before execution");
    }

    if (actor.type === "bhudhi" && (action === "EXECUTE_WORKFLOW" || action === "DEPLOY_SYSTEM")) {
      constraints.push("Bhudhi execution requires external approval (not self)");
      requiredApprovals.push("L2");
    }

    const allowed =
      constraints.filter((c) => c.includes("below required") || c.includes("forbidden")).length === 0 &&
      !isForbiddenAction(action);

    return {
      allowed,
      confidence,
      requiredApprovals: [...new Set(requiredApprovals)],
      constraints,
      category: categoryForAction(action),
      reason: allowed ? undefined : constraints.join("; ") || "Policy constraints not met",
    };
  }
}

export const policyEngine = new PolicyEngine();
