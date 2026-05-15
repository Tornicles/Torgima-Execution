import type { BlueprintTier } from "./blueprint-types.js";
import { getBlueprintTypeConfig } from "./BlueprintTypeRegistry.js";

/** Phase-1 framework activation posture — operational overlay, not labels. */
const FRAMEWORK_STATUS: Record<string, "active" | "limited" | "disabled"> = {
  governance_risk: "active",
  strategycore: "active",
  synergyops: "active",
  customervalue: "active",
  clarity_catalyst: "active",
  finmatrix: "limited",
  talentsync: "limited",
  alignment_accountability: "limited",
  omnigrowth: "limited",
  adaptive_intelligence: "limited",
  knowledgeflow: "limited",
  decision_velocity: "limited",
  regeneration_exit: "limited",
  culture_dynamics: "disabled",
};

export function getFrameworkExecutionOverlay(tier: BlueprintTier, frameworkKey: string) {
  const cfg = getBlueprintTypeConfig(tier);
  const status = FRAMEWORK_STATUS[frameworkKey] ?? "limited";
  const tierAllows =
    cfg.allowedFrameworks === "full" ? true
    : cfg.allowedFrameworks === "limited" ? status !== "disabled"
    : status === "active";

  return {
    frameworkKey,
    status,
    operational: tierAllows,
    sequencing: tierAllows ? "enforce" : "monitor",
    influencesOrders: tierAllows && status === "active",
    influencesRecovery: frameworkKey === "regeneration_exit" && tierAllows,
  };
}

export function listOperationalFrameworks(tier: BlueprintTier): string[] {
  return Object.keys(FRAMEWORK_STATUS).filter((k) => getFrameworkExecutionOverlay(tier, k).operational);
}
