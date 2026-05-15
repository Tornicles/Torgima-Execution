import { TorgimaError } from "../../../lib/errors.js";
import type { BlueprintMode, BlueprintTier } from "./blueprint-types.js";
import { getBlueprintTypeConfig } from "./BlueprintTypeRegistry.js";

export type HierarchyLayer =
  | "goal"
  | "plan"
  | "season"
  | "target"
  | "phase"
  | "project"
  | "action"
  | "order";

const PARENT_MAP: Record<HierarchyLayer, HierarchyLayer | null> = {
  goal: null,
  plan: "goal",
  season: "plan",
  target: "plan",
  phase: "target",
  project: "phase",
  action: "project",
  order: "action",
};

export interface HierarchyNode {
  id: string;
  layer: HierarchyLayer;
  parentId: string | null;
  parentLayer: HierarchyLayer | null;
  tier: BlueprintTier;
  mode: BlueprintMode;
}

export interface HierarchyValidationResult {
  valid: boolean;
  violations: string[];
}

export function validateHierarchyNodes(nodes: HierarchyNode[]): HierarchyValidationResult {
  const violations: string[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    const expectedParent = PARENT_MAP[node.layer];
    if (expectedParent && node.parentLayer !== expectedParent) {
      violations.push(`${node.layer}:${node.id} has invalid parent layer ${node.parentLayer ?? "none"}`);
    }
    if (node.parentId && !byId.has(node.parentId)) {
      violations.push(`${node.layer}:${node.id} orphan — parent ${node.parentId} missing`);
    }
    const cfg = getBlueprintTypeConfig(node.tier);
    if (node.layer === "plan" && cfg.planCount < 1) {
      violations.push(`tier ${node.tier} cannot host plans`);
    }
  }

  const planCount = nodes.filter((n) => n.layer === "plan").length;
  const tier = nodes[0]?.tier ?? "starter";
  const maxPlans = getBlueprintTypeConfig(tier).planCount;
  if (planCount > maxPlans) {
    violations.push(`plan count ${planCount} exceeds tier cap ${maxPlans}`);
  }

  if (hasCircularReference(nodes)) {
    violations.push("circular dependency detected in hierarchy");
  }

  return { valid: violations.length === 0, violations };
}

function hasCircularReference(nodes: HierarchyNode[]): boolean {
  const parentOf = new Map<string, string | null>();
  for (const n of nodes) parentOf.set(n.id, n.parentId);

  for (const start of nodes) {
    const seen = new Set<string>();
    let cur: string | null = start.id;
    while (cur) {
      if (seen.has(cur)) return true;
      seen.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
  }
  return false;
}

export function assertValidHierarchy(nodes: HierarchyNode[]): void {
  const result = validateHierarchyNodes(nodes);
  if (!result.valid) {
    throw new TorgimaError("VALIDATION_ERROR", `Hierarchy invalid: ${result.violations.join("; ")}`);
  }
}

export async function validatePersistedBlueprintHierarchy(
  blueprintId: string,
  loadNodes: (id: string) => Promise<HierarchyNode[]>,
): Promise<HierarchyValidationResult> {
  const nodes = await loadNodes(blueprintId);
  return validateHierarchyNodes(nodes);
}
