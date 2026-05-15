import { describe, it, expect } from "vitest";
import {
  getBlueprintTypeConfig,
  isBlueprintSystemAllowed,
} from "../../../engines/blueprint/infrastructure/BlueprintTypeRegistry.js";
import { assertFeatureAllowed, isFeatureAllowed } from "../../../engines/blueprint/infrastructure/FeatureGatingEngine.js";
import { validateHierarchyNodes } from "../../../engines/blueprint/infrastructure/HierarchyValidator.js";
import { getConditionContract } from "../../../engines/blueprint/infrastructure/ConditionEnforcementMatrix.js";
import { aggregateTeamSignals } from "../../../engines/blueprint/infrastructure/TeamSignalAggregationEngine.js";
import { deriveOperationalState } from "../../../engines/blueprint/infrastructure/BlueprintFailureStates.js";
import { validateAIGeneratedObject } from "../../../engines/blueprint/infrastructure/AIGenerationContracts.js";
import { getOrderTemplate } from "../../../engines/blueprint/infrastructure/OrderTemplateSystem.js";

describe("Blueprint infrastructure hardening", () => {
  it("registry is single source for tier caps", () => {
    const s = getBlueprintTypeConfig("starter");
    const u = getBlueprintTypeConfig("ultimate");
    expect(s.planCount).toBeLessThan(u.planCount);
    expect(isBlueprintSystemAllowed("starter", "predictive_signals")).toBe(false);
    expect(isBlueprintSystemAllowed("ultimate", "predictive_signals")).toBe(true);
  });

  it("feature gating blocks ultimate features on starter", () => {
    expect(isFeatureAllowed("starter", "predictive_signals")).toBe(false);
    expect(() =>
      assertFeatureAllowed({ tier: "starter", mode: "individual", feature: "predictive_signals", surface: "api" }),
    ).toThrow();
  });

  it("hierarchy validator rejects orphans", () => {
    const result = validateHierarchyNodes([
      {
        id: "g1",
        layer: "goal",
        parentId: null,
        parentLayer: null,
        tier: "starter",
        mode: "individual",
      },
      {
        id: "p1",
        layer: "plan",
        parentId: "missing",
        parentLayer: "goal",
        tier: "starter",
        mode: "individual",
      },
    ]);
    expect(result.valid).toBe(false);
  });

  it("condition matrix defines nothingness contract", () => {
    const c = getConditionContract("nothingness");
    expect(c.allowedExpansion).toBe(false);
    expect(c.taskMax).toBe(2);
  });

  it("team signal aggregation is deterministic", () => {
    const a = aggregateTeamSignals([
      { userId: "1", completionRate: 0.8, momentum: 60, proofReliability: 0.9, activeOrderLoad: 2 },
      { userId: "2", completionRate: 0.7, momentum: 55, proofReliability: 0.85, activeOrderLoad: 3 },
    ]);
    const b = aggregateTeamSignals([
      { userId: "1", completionRate: 0.8, momentum: 60, proofReliability: 0.9, activeOrderLoad: 2 },
      { userId: "2", completionRate: 0.7, momentum: 55, proofReliability: 0.85, activeOrderLoad: 3 },
    ]);
    expect(a.teamMomentum).toBe(b.teamMomentum);
  });

  it("failure states derive from signals", () => {
    expect(deriveOperationalState({ blueprintStatus: "active", condition: "danger", momentum: 50, completionRate: 0.5 })).toBe(
      "RECOVERY",
    );
    expect(deriveOperationalState({ blueprintStatus: "active", condition: "stability", momentum: 80, completionRate: 0.8 })).toBe(
      "ACTIVE",
    );
  });

  it("AI contracts reject malformed orders", () => {
    const r = validateAIGeneratedObject("order", { title: "x" });
    expect(r.valid).toBe(false);
  });

  it("order templates vary by tier", () => {
    const s = getOrderTemplate("starter", "execution");
    const u = getOrderTemplate("ultimate", "execution");
    expect(s.detailDepth).not.toBe(u.detailDepth);
  });
});
