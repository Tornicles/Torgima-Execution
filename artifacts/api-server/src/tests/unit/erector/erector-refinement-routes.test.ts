import { describe, expect, it } from "vitest";
import {
  parseGoalUnderstandBody,
  parsePurposeUnderstandBody,
  refineGoalOptions,
  refinePurposeOptions,
} from "../../../lib/erectorRefinementRoutes.js";

describe("POST /v1/erector/refinement goal/purpose understand parsers", () => {
  it("empty rawGoal returns 400 fieldErrors", () => {
    const parsed = parseGoalUnderstandBody({ rawGoal: "   " });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors.rawGoal).toBeDefined();
  });

  it("valid rawGoal returns exactly 3 options", () => {
    const parsed = parseGoalUnderstandBody({ rawGoal: "I want to create a fitness app" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const options = refineGoalOptions(parsed.rawGoal);
    expect(options).toHaveLength(3);
    expect(options.every((o) => o.length > 20)).toBe(true);
  });

  it("empty rawPurpose returns 400 fieldErrors", () => {
    const parsed = parsePurposeUnderstandBody({ rawPurpose: "", selectedGoal: "Build a fitness app" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors.rawPurpose).toBeDefined();
  });

  it("missing selectedGoal returns 400 fieldErrors", () => {
    const parsed = parsePurposeUnderstandBody({ rawPurpose: "Help people stay fit", selectedGoal: "" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors.selectedGoal).toBeDefined();
  });

  it("valid purpose payload returns exactly 3 options aligned to goal", () => {
    const parsed = parsePurposeUnderstandBody({
      rawPurpose: "I want to help Africans stay fit",
      selectedGoal: "Build a fitness coaching app",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const options = refinePurposeOptions(parsed.rawPurpose, parsed.selectedGoal);
    expect(options).toHaveLength(3);
    expect(options[0]).toMatch(/purpose is/i);
  });
});
