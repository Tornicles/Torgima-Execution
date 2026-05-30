import { describe, expect, it } from "vitest";
import {
  buildRefinementFallbackOptions,
  safeRefineGoalOptions,
  safeRefinePurposeOptions,
} from "../../../lib/erectorRefinementRoutes.js";

describe("Erector refinement fallback", () => {
  it("buildRefinementFallbackOptions returns 3 polished sentences", () => {
    const opts = buildRefinementFallbackOptions("Build a SaaS");
    expect(opts).toHaveLength(3);
    expect(opts.every((o) => o.length > 10 && /\.$/.test(o))).toBe(true);
  });

  it("safeRefineGoalOptions returns at least 3 options", () => {
    const opts = safeRefineGoalOptions("Launch an online coaching business");
    expect(opts.length).toBeGreaterThanOrEqual(3);
  });

  it("polishes messy goal text away from raw input", () => {
    const raw = "i wnat to bild app for wether that help peple no when rain coming";
    const opts = safeRefineGoalOptions(raw);
    expect(opts).toHaveLength(3);
    for (const o of opts) {
      expect(o.toLowerCase()).not.toBe(raw.toLowerCase());
      expect(o).toMatch(/\.$/);
    }
  });

  it("safeRefinePurposeOptions returns at least 3 options", () => {
    const opts = safeRefinePurposeOptions(
      "Help founders execute",
      "Build a validation platform",
    );
    expect(opts.length).toBeGreaterThanOrEqual(3);
  });
});
