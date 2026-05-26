import type {
  CapabilityDefinition,
  CapabilityRisk,
  GovernanceAction,
  ApprovalLevel,
} from "../contracts/types.js";
import { isForbiddenAction } from "../contracts/immutableRules.js";

const CAPABILITIES: CapabilityDefinition[] = [
  { capability: "READ_MEMORY", owner: "bhudhi", risk: "LOW", requiresApproval: "L0", requiresSimulation: false, requiresAudit: false, immutable: false },
  { capability: "CREATE_TASKS", owner: "bhudhi", risk: "LOW", requiresApproval: "L1", requiresSimulation: false, requiresAudit: true, immutable: false },
  { capability: "GENERATE_PLAN", owner: "bhudhi", risk: "LOW", requiresApproval: "L1", requiresSimulation: false, requiresAudit: true, immutable: false },
  { capability: "RUN_SIMULATION", owner: "bhudhi", risk: "MEDIUM", requiresApproval: "L1", requiresSimulation: true, requiresAudit: true, immutable: false },
  { capability: "EXECUTE_WORKFLOW", owner: "operating", risk: "HIGH", requiresApproval: "L2", requiresSimulation: false, requiresAudit: true, immutable: false },
  { capability: "MEMORY_WRITE", owner: "preservation", risk: "MEDIUM", requiresApproval: "L2", requiresSimulation: false, requiresAudit: true, immutable: false },
  { capability: "LEARNING_UPDATE", owner: "preservation", risk: "MEDIUM", requiresApproval: "L2", requiresSimulation: false, requiresAudit: true, immutable: false },
  { capability: "DEPLOY_SYSTEM", owner: "operating", risk: "CRITICAL", requiresApproval: "L4", requiresSimulation: true, requiresAudit: true, immutable: false },
  { capability: "AGENT_SPAWN", owner: "bhudhi", risk: "HIGH", requiresApproval: "L3", requiresSimulation: true, requiresAudit: true, immutable: false },
  { capability: "MODIFY_POLICIES", owner: "governance", risk: "FORBIDDEN", requiresApproval: "L5", requiresSimulation: false, requiresAudit: true, immutable: true },
  { capability: "MODIFY_SIGNALS", owner: "forbidden", risk: "FORBIDDEN", requiresApproval: "L5", requiresSimulation: false, requiresAudit: true, immutable: true },
  { capability: "MODIFY_CONDITIONS", owner: "forbidden", risk: "FORBIDDEN", requiresApproval: "L5", requiresSimulation: false, requiresAudit: true, immutable: true },
  { capability: "REWRITE_BLUEPRINT", owner: "forbidden", risk: "FORBIDDEN", requiresApproval: "L5", requiresSimulation: false, requiresAudit: true, immutable: true },
  { capability: "OVERRIDE_VALIDATION", owner: "forbidden", risk: "FORBIDDEN", requiresApproval: "L5", requiresSimulation: false, requiresAudit: true, immutable: true },
  { capability: "DISABLE_TRIGGER_ROUTER", owner: "forbidden", risk: "FORBIDDEN", requiresApproval: "L5", requiresSimulation: false, requiresAudit: true, immutable: true },
  { capability: "SELF_APPROVE", owner: "forbidden", risk: "FORBIDDEN", requiresApproval: "L5", requiresSimulation: false, requiresAudit: true, immutable: true },
  { capability: "DELETE_AUDIT", owner: "forbidden", risk: "FORBIDDEN", requiresApproval: "L5", requiresSimulation: false, requiresAudit: true, immutable: true },
  { capability: "ESCALATE_PRIVILEGE", owner: "forbidden", risk: "FORBIDDEN", requiresApproval: "L5", requiresSimulation: false, requiresAudit: true, immutable: true },
  { capability: "SELF_DEPLOY", owner: "forbidden", risk: "FORBIDDEN", requiresApproval: "L5", requiresSimulation: false, requiresAudit: true, immutable: true },
];

export class CapabilityRegistry {
  get(action: GovernanceAction): CapabilityDefinition | undefined {
    return CAPABILITIES.find((c) => c.capability === action);
  }

  list(): CapabilityDefinition[] {
    return [...CAPABILITIES];
  }

  authorize(action: GovernanceAction): {
    authorized: boolean;
    capability?: CapabilityDefinition;
    reason?: string;
  } {
    if (isForbiddenAction(action)) {
      return { authorized: false, reason: `Action ${action} is constitutionally forbidden` };
    }

    const cap = this.get(action);
    if (!cap) {
      return { authorized: false, reason: `Unknown capability: ${action}` };
    }

    if (cap.risk === "FORBIDDEN" || cap.immutable) {
      return { authorized: false, capability: cap, reason: `${action} is locked (L5)` };
    }

    return { authorized: true, capability: cap };
  }
}

export const capabilityRegistry = new CapabilityRegistry();
