/**
 * Deterministic lifecycle vocabulary for blueprint-aligned entities (execution authority stays in DB + engines).
 * Use for validation at mutation boundaries — does not imply rows store these enums yet (many use legacy status fields).
 */

export const BLUEPRINT_LIFECYCLE_STATES = [
  "LOCKED",
  "AVAILABLE",
  "ACTIVE",
  "STALLED",
  "RECOVERY",
  "COMPLETED",
  "ARCHIVED",
] as const;

export type BlueprintLifecycleState = (typeof BLUEPRINT_LIFECYCLE_STATES)[number];

/** Directed adjacency — keys are FROM states; values are legal TO states. */
const GRAPH: Record<BlueprintLifecycleState, readonly BlueprintLifecycleState[]> = {
  LOCKED:     ["AVAILABLE", "ARCHIVED"],
  AVAILABLE:  ["ACTIVE", "LOCKED", "ARCHIVED"],
  ACTIVE:     ["STALLED", "RECOVERY", "COMPLETED", "AVAILABLE", "ARCHIVED"],
  STALLED:    ["RECOVERY", "ACTIVE", "ARCHIVED"],
  RECOVERY:   ["ACTIVE", "STALLED", "COMPLETED", "ARCHIVED"],
  COMPLETED:  ["ARCHIVED"],
  ARCHIVED:   [],
};

export function isBlueprintLifecycleTransitionAllowed(
  from: BlueprintLifecycleState,
  to: BlueprintLifecycleState,
): boolean {
  return (GRAPH[from] as readonly BlueprintLifecycleState[]).includes(to);
}

export function assertBlueprintLifecycleTransition(
  entityLabel: string,
  from: BlueprintLifecycleState,
  to: BlueprintLifecycleState,
): void {
  if (from === to) return;
  if (!isBlueprintLifecycleTransitionAllowed(from, to)) {
    throw new Error(
      `[BlueprintStateMachine] Illegal ${entityLabel} transition: ${from} → ${to}. Allowed: ${GRAPH[from]?.join(", ") ?? "none"}`,
    );
  }
}
