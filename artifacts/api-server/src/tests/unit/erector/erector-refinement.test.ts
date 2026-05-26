import { describe, expect, it } from "vitest";
import {
  generateGoalOptionsDeterministic,
  generatePurposeOptionsDeterministic,
  understandGoalDeterministic,
  understandPurposeDeterministic,
} from "../../../engines/erector/ErectorRefinementEngine.js";

describe("Erector goal/purpose refinement", () => {
  it("extracts goal understanding from raw fitness app input", () => {
    const u = understandGoalDeterministic("I want to create a fitness app");
    expect(u.object).toBeTruthy();
    expect(u.domain).toMatch(/fitness/i);
    expect(u.unclear.length).toBeGreaterThan(0);
  });

  it("produces three goal options", () => {
    const raw = "I want to create a fitness app";
    const u = understandGoalDeterministic(raw);
    const options = generateGoalOptionsDeterministic(raw, u);
    expect(options).toHaveLength(3);
    expect(options[0]).toMatch(/fitness/i);
  });

  it("produces three purpose options", () => {
    const u = understandPurposeDeterministic("I want to help Africans stay fit", "Build a fitness app");
    const options = generatePurposeOptionsDeterministic("I want to help Africans stay fit", u);
    expect(options).toHaveLength(3);
    expect(options[0]).toMatch(/purpose is/i);
  });
});
