import type {
  AuthorizationResult,
  CapabilityLevel,
  SecurityInput,
  SecurityPermission,
  TrustLevel,
} from "../contracts/types.js";

const LEVEL_ORDER: CapabilityLevel[] = ["PUBLIC", "LIMITED", "PRIVILEGED", "CRITICAL", "IMMUTABLE"];

export class AuthorizationEngine {
  authorize(
    input: SecurityInput,
    trustLevel: TrustLevel,
    permission: SecurityPermission = "execute",
  ): AuthorizationResult {
    const caps = input.capabilities ?? [];
    const maxCap = caps.reduce((max, c) => {
      const idx = LEVEL_ORDER.indexOf(c.level);
      const maxIdx = LEVEL_ORDER.indexOf(max);
      return idx > maxIdx ? c.level : max;
    }, "PUBLIC" as CapabilityLevel);

    const role = String(input.identity?.role ?? "user");
    const constraints: string[] = [];
    const approvals: string[] = [];

    let allowed = false;

    if (trustLevel === "UNTRUSTED") {
      return { allowed: false, constraints: ["default_deny"], approvals: [] };
    }

    if (permission === "read") {
      allowed = trustLevel !== "UNTRUSTED";
    } else if (permission === "execute") {
      allowed = ["TRUSTED", "ELEVATED", "SEALED"].includes(trustLevel) || maxCap === "PRIVILEGED";
      if (maxCap === "CRITICAL" || maxCap === "IMMUTABLE") {
        approvals.push("governance");
      }
    } else if (permission === "approve") {
      allowed = trustLevel === "ELEVATED" || trustLevel === "SEALED" || role === "OWNER";
      approvals.push("dual_control");
    } else if (permission === "delegate") {
      allowed = trustLevel === "ELEVATED" || trustLevel === "SEALED";
      constraints.push("delegate_scope_limited");
    } else if (permission === "recover") {
      allowed = trustLevel === "SEALED" || role === "OWNER";
      approvals.push("audit_trail");
    }

    if (input.governance?.blocked === true) {
      allowed = false;
      constraints.push("governance_blocked");
    }

    if (input.execution?.unknownOrigin === true) {
      constraints.push("sandbox_required");
      allowed = allowed && maxCap !== "IMMUTABLE";
    }

    return { allowed, constraints, approvals };
  }
}

export const authorizationEngine = new AuthorizationEngine();
