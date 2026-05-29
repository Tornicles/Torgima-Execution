import { describe, expect, it } from "vitest";
import {
  buildRefinementFallbackOptions,
  safeRefineGoalOptions,
  safeRefinePurposeOptions,
} from "../../../lib/erectorRefinementRoutes.js";

describe("Erector refinement fallback", () => {
  it("buildRefinementFallbackOptions returns 3 strings", () => {
    const opts = buildRefinementFallbackOptions("Build a SaaS");
    expect(opts).toHaveLength(3);
    expect(opts.every((o) => o.includes("Build a SaaS"))).toBe(true);
  });

  it("safeRefineGoalOptions returns at least 3 options", () => {
    const opts = safeRefineGoalOptions("Launch an online coaching business");
    expect(opts.length).toBeGreaterThanOrEqual(3);
  });

  it("safeRefinePurposeOptions returns at least 3 options", () => {
    const opts = safeRefinePurposeOptions(
      "Help founders execute",
      "Build a validation platform",
    );
    expect(opts.length).toBeGreaterThanOrEqual(3);
  });
});
