import { describe, expect, it } from "vitest";
import { polishGoalOptions, polishPurposeOptions } from "../../../lib/refinementTextPolish.js";

const MESSY_GOAL = "i wnat to bild app for wether that help peple no when rain coming";

describe("refinementTextPolish", () => {
  it("returns 3 corrected goal options for messy input", () => {
    const options = polishGoalOptions(MESSY_GOAL);
    expect(options).toHaveLength(3);
    for (const o of options) {
      expect(o).toMatch(/\.$/);
      expect(o.toLowerCase()).not.toBe(MESSY_GOAL.toLowerCase());
      expect(o.length).toBeGreaterThan(30);
    }
    expect(options.some((o) => /weather|rain/i.test(o))).toBe(true);
  });

  it("returns 3 purpose options aligned with selected goal", () => {
    const selectedGoal = "Build a weather app that helps people know when rain is coming.";
    const rawPurpose = "becos weather apps not accurat and people get wet or plan bad";
    const options = polishPurposeOptions(rawPurpose, selectedGoal);
    expect(options).toHaveLength(3);
    for (const o of options) {
      expect(o).toMatch(/\.$/);
      expect(o.toLowerCase()).not.toBe(rawPurpose.toLowerCase());
    }
    expect(options[0]).toMatch(/purpose is/i);
  });

  it("preserves fitness in goal options", () => {
    const options = polishGoalOptions("I want to create a fitness app");
    expect(options[0]).toMatch(/fitness/i);
    expect(options.every((o) => !/\bachieve achieve\b/i.test(o))).toBe(true);
  });
});
