import type { GovernanceAction } from "./types.js";

/** Actions Bhudhi and agents may never perform — constitutional immutables */
export const FORBIDDEN_GOVERNANCE_ACTIONS: ReadonlySet<GovernanceAction> = new Set([
  "MODIFY_SIGNALS",
  "MODIFY_CONDITIONS",
  "REWRITE_BLUEPRINT",
  "OVERRIDE_VALIDATION",
  "DISABLE_TRIGGER_ROUTER",
  "SELF_APPROVE",
  "DELETE_AUDIT",
  "MODIFY_POLICIES",
  "ESCALATE_PRIVILEGE",
  "SELF_DEPLOY",
]);

export const IMMUTABLE_SYSTEM_LAWS = [
  "Signals are immutable — Bhudhi may read, never write",
  "Conditions are immutable — Bhudhi may read, never write",
  "Blueprint mutations require human governance queue approval",
  "Validation precedes execution — no bypass",
  "Trigger Router remains first gate for all AI calls",
  "Audit logs are append-only and never deletable",
  "Bhudhi cannot approve its own execution",
  "Governance approves — Bhudhi executes",
] as const;

export function isForbiddenAction(action: GovernanceAction): boolean {
  return FORBIDDEN_GOVERNANCE_ACTIONS.has(action);
}

/** Bhudhi system actor cannot grant L4/L5 or self-approve */
export function actorMayApprove(
  actorType: string,
  level: string,
): boolean {
  if (actorType === "bhudhi" || actorType === "system") {
    return level === "L0" || level === "L1";
  }
  if (actorType === "agent") {
    return level === "L0" || level === "L1" || level === "L2";
  }
  return true;
}
