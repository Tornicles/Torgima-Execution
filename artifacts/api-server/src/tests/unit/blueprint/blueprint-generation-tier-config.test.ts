import { describe, expect, it } from "vitest";
import { getTierConfig } from "../../../engines/blueprint/TierConfig.js";

/** Expected chain row counts from TierConfig (BlueprintGenerationEngine). */
function expectedChainCounts(tier: "starter" | "growth" | "ultimate") {
  const cfg = getTierConfig(tier);
  const planCount = cfg.plans.length;
  const seasonCount = cfg.seasons_enabled ? (cfg.seasons?.length ?? 0) : 0;
  const targetCount = planCount * cfg.target_types.length;
  const phaseCount = targetCount * cfg.phases.length;
  const projectCount = cfg.project_types.length;
  const actionCount = projectCount * cfg.action_types.length;
  return { planCount, seasonCount, targetCount, phaseCount, projectCount, actionCount };
}

describe("BlueprintGenerationEngine tier dimensions", () => {
  it("STARTER: 3 plans, no seasons, 3 target types per plan", () => {
    const c = expectedChainCounts("starter");
    expect(c.planCount).toBe(3);
    expect(c.seasonCount).toBe(0);
    expect(c.targetCount).toBe(9);
    expect(c.phaseCount).toBe(27);
    expect(c.projectCount).toBe(2);
    expect(c.actionCount).toBe(4);
  });

  it("GROWTH: 4 plans, 4 seasons, 6 target types per plan", () => {
    const c = expectedChainCounts("growth");
    expect(c.planCount).toBe(4);
    expect(c.seasonCount).toBe(4);
    expect(c.targetCount).toBe(24);
    expect(c.phaseCount).toBe(72);
    expect(c.projectCount).toBe(4);
    expect(c.actionCount).toBe(16);
  });

  it("ULTIMATE: same structural counts as growth plus adaptive flags in config", () => {
    const growth = expectedChainCounts("growth");
    const ultimate = expectedChainCounts("ultimate");
    expect(ultimate.planCount).toBe(growth.planCount);
    expect(ultimate.seasonCount).toBe(growth.seasonCount);
    expect(ultimate.targetCount).toBe(growth.targetCount);
    const cfg = getTierConfig("ultimate");
    expect(cfg.adaptive_targets).toBe(true);
    expect(cfg.predictive_signals).toBe(true);
  });
});
