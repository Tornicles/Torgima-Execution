import { describe, it, expect } from "vitest";
import {
  getTierRules,
  getModeRules,
  isSystemAllowed,
  parseTier,
  parseMode,
  intelligenceDepthForTier,
} from "../../../engines/blueprint/BlueprintRuleEngine.js";

describe("BlueprintRuleEngine", () => {
  it("starter has reduced structure vs growth", () => {
    const starter = getTierRules("starter");
    const growth = getTierRules("growth");
    expect(starter.planCount).toBeLessThan(growth.planCount);
    expect(starter.targetCount).toBeLessThan(growth.targetCount);
    expect(starter.maxDailyOrders).toBeLessThan(growth.maxDailyOrders);
  });

  it("matches the master blueprint tier structure", () => {
    const starter = getTierRules("starter");
    const growth = getTierRules("growth");
    const ultimate = getTierRules("ultimate");

    expect(starter.planCount).toBe(3);
    expect(starter.seasonCount).toBe(1);
    expect(starter.targetCount).toBe(9);
    expect(starter.actionsPerProject).toBe(2);

    expect(growth.planCount).toBeGreaterThanOrEqual(3);
    expect(growth.seasonCount).toBe(4);
    expect(growth.targetCount).toBe(24);
    expect(growth.phaseGates).toBe(true);

    expect(ultimate.allowedSystems).toContain("predictive_signals");
    expect(ultimate.adaptivePhases).toBe(true);
    expect(ultimate.signalComplexity).toBe("predictive");
  });

  it("ultimate unlocks predictive systems", () => {
    const ultimate = getTierRules("ultimate");
    expect(isSystemAllowed("ultimate", "predictive_signals")).toBe(true);
    expect(isSystemAllowed("starter", "predictive_signals")).toBe(false);
  });

  it("team mode enables distributed execution flags", () => {
    const team = getModeRules("team");
    const individual = getModeRules("individual");
    expect(team.sharedBlueprint).toBe(true);
    expect(team.distributedExecution).toBe(true);
    expect(individual.distributedExecution).toBe(false);
  });

  it("parses tier and mode safely", () => {
    expect(parseTier("ultimate")).toBe("ultimate");
    expect(parseTier(null)).toBe("starter");
    expect(parseMode("team")).toBe("team");
    expect(parseMode(undefined)).toBe("individual");
  });

  it("maps intelligence depth per tier", () => {
    expect(intelligenceDepthForTier("starter")).toBe("guided");
    expect(intelligenceDepthForTier("growth")).toBe("operational");
    expect(intelligenceDepthForTier("ultimate")).toBe("strategic");
  });
});
