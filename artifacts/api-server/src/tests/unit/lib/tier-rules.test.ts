import { describe, it, expect } from "vitest";
import {
  TIER_RULES,
  computeTierEnforcementLimits,
  getTierRules,
} from "../../../lib/tier-rules.js";

describe("tier-rules — Starter/Growth/Ultimate enforcement", () => {
  it("defines all 3 tiers", () => {
    expect(Object.keys(TIER_RULES)).toEqual(["starter", "growth", "ultimate"]);
  });

  it("starter in power condition: task_limits.max = 4, difficulty_cap = hard", () => {
    const result = computeTierEnforcementLimits("starter", "power");
    expect(result.taskMax).toBe(4);
    expect(result.difficultyCap).toBe("hard");
    expect(result.knowledge_injection_level).toBe("minimal");
  });

  it("growth in power condition: task_limits.max = 6", () => {
    const result = computeTierEnforcementLimits("growth", "power");
    expect(result.taskMax).toBe(6);
    expect(result.knowledge_injection_level).toBe("full");
  });

  it("ultimate tier: framework_veto_active = true", () => {
    const ultimate = getTierRules("ultimate");
    expect("framework_veto_active" in ultimate && ultimate.framework_veto_active).toBe(true);
    const result = computeTierEnforcementLimits("ultimate", "stability");
    expect(result.tierOverrideFlags.framework_veto_active).toBe(true);
  });
});
