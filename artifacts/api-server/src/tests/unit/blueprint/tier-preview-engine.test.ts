import { describe, expect, it } from "vitest";
import {
  recommendTier,
  computeGrowthProjection,
} from "../../../engines/blueprint/TierPreviewEngine.js";

describe("TierPreviewEngine helpers", () => {
  it("recommends starter when average score is below 0.5 (0-100 scale)", () => {
    expect(
      recommendTier({ feasibility_score: 40, clarity_score: 35, realism_score: 45 }),
    ).toBe("starter");
  });

  it("recommends growth for mid scores", () => {
    expect(
      recommendTier({ feasibility_score: 60, clarity_score: 65, realism_score: 70 }),
    ).toBe("growth");
  });

  it("recommends ultimate for high scores", () => {
    expect(
      recommendTier({ feasibility_score: 85, clarity_score: 90, realism_score: 88 }),
    ).toBe("ultimate");
  });

  it("applies tier multipliers to growth projection", () => {
    const starter = computeGrowthProjection(0.6, "starter");
    const ultimate = computeGrowthProjection(0.6, "ultimate");
    const s30 = parseInt(starter.days30, 10);
    const u30 = parseInt(ultimate.days30, 10);
    expect(u30).toBeGreaterThan(s30);
  });
});
