import { describe, expect, it } from "vitest";
import {
  ALL_SEQUENCES,
  TOTAL_NUMBERED_SEQUENCES,
} from "../../../types/sequences.js";
import {
  computeSequenceLocked,
  normalizeBlueprintTier,
  tierMeetsRequirement,
} from "../../../engines/sequence/SequenceTracker.js";

describe("SequenceTracker (Prompt 1 foundation)", () => {
  it("tracks all 25 sequences", () => {
    expect(Object.keys(ALL_SEQUENCES)).toHaveLength(25);
    expect(ALL_SEQUENCES[1].name).toBe("Goal Intake");
    expect(ALL_SEQUENCES[23].name).toBe("Continuous Task Guarantee");
    expect(ALL_SEQUENCES[24].tier).toBe("Growth");
    expect(ALL_SEQUENCES[25].tier).toBe("Ultimate");
    expect(TOTAL_NUMBERED_SEQUENCES).toBe(25);
  });

  it("normalizes blueprint tier labels", () => {
    expect(normalizeBlueprintTier("starter")).toBe("Starter");
    expect(normalizeBlueprintTier("growth")).toBe("Growth");
    expect(normalizeBlueprintTier(null, "ultimate")).toBe("Ultimate");
  });

  it("locks Growth sequence for Starter tier", () => {
    const locked = computeSequenceLocked(24, "Starter", [23]);
    expect(locked).toBe(true);
  });

  it("unlocks Growth sequence when tier and prerequisite met", () => {
    const locked = computeSequenceLocked(24, "Growth", [23]);
    expect(locked).toBe(false);
  });

  it("locks Ultimate sequence without prerequisite 24", () => {
    const locked = computeSequenceLocked(25, "Ultimate", [23]);
    expect(locked).toBe(true);
  });

  it("unlocks Ultimate sequence when prerequisite 24 complete", () => {
    const locked = computeSequenceLocked(25, "Ultimate", [24]);
    expect(locked).toBe(false);
  });

  it("tierMeetsRequirement respects Growth and Ultimate", () => {
    expect(tierMeetsRequirement("Starter", "Growth")).toBe(false);
    expect(tierMeetsRequirement("Growth", "Growth")).toBe(true);
    expect(tierMeetsRequirement("Ultimate", "Growth")).toBe(true);
    expect(tierMeetsRequirement("Growth", "Ultimate")).toBe(false);
  });

  it("rejects invalid sequence numbers as locked", () => {
    expect(computeSequenceLocked(999, "Starter", [])).toBe(true);
  });
});
