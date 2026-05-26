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
import {
  buildFeatureAvailability,
  isFeatureAvailable,
} from "../../../lib/featureGate.js";
import { getTierNavItems, getUnlockedTierNav } from "../../../lib/tierNav.js";
import { checkTierAccess, checkSequenceAccess } from "../../../engines/sequence/tierSequenceGate.js";
import type { BlueprintSequenceRow } from "../../../engines/sequence/SequenceTracker.js";

function mockBlueprint(overrides: Partial<BlueprintSequenceRow>): BlueprintSequenceRow {
  return {
    id: "bp-test",
    tier: "starter",
    blueprint_tier: "Starter",
    selected_blueprint_level: null,
    current_sequence_number: 1,
    sequences_completed_numbers: [],
    sequence_audit_log: [],
    last_sequence_update: null,
    ...overrides,
  };
}

describe("25-Sequence tier integration (Prompt 4)", () => {
  it("defines all 25 sequences with correct tier labels", () => {
    expect(Object.keys(ALL_SEQUENCES)).toHaveLength(25);
    expect(ALL_SEQUENCES[24].tier).toBe("Growth");
    expect(ALL_SEQUENCES[25].tier).toBe("Ultimate");
    expect(TOTAL_NUMBERED_SEQUENCES).toBe(25);
  });

  it("locks Growth sequence for Starter tier", () => {
    const bp = mockBlueprint({ blueprint_tier: "Starter", sequences_completed_numbers: [23] });
    expect(computeSequenceLocked(24, "Starter", bp.sequences_completed_numbers)).toBe(true);
    expect(checkTierAccess(bp, "Growth").allowed).toBe(false);
  });

  it("unlocks Growth sequence when tier and prerequisite met", () => {
    const bp = mockBlueprint({
      blueprint_tier: "Growth",
      sequences_completed_numbers: [23],
      current_sequence_number: 24,
    });
    expect(computeSequenceLocked(24, "Growth", bp.sequences_completed_numbers)).toBe(false);
    expect(checkTierAccess(bp, "Growth").allowed).toBe(true);
    expect(checkSequenceAccess(bp, 24).allowed).toBe(true);
  });

  it("locks Ultimate sequence for Growth tier", () => {
    const bp = mockBlueprint({
      blueprint_tier: "Growth",
      sequences_completed_numbers: [24],
    });
    expect(computeSequenceLocked(25, "Growth", bp.sequences_completed_numbers)).toBe(true);
    expect(checkTierAccess(bp, "Ultimate").allowed).toBe(false);
  });

  it("unlocks Ultimate sequence for Ultimate tier with prerequisite 24", () => {
    const bp = mockBlueprint({
      blueprint_tier: "Ultimate",
      sequences_completed_numbers: [24],
      current_sequence_number: 25,
    });
    expect(computeSequenceLocked(25, "Ultimate", bp.sequences_completed_numbers)).toBe(false);
    expect(checkTierAccess(bp, "Ultimate").allowed).toBe(true);
    expect(checkSequenceAccess(bp, 25).allowed).toBe(true);
  });

  it("gates growth features via featureGate", () => {
    const starterFeatures = buildFeatureAvailability({
      tier: "starter",
      blueprint_tier: "Starter",
      selected_blueprint_level: null,
      current_sequence_number: 23,
      sequences_completed_numbers: [23],
    });
    expect(starterFeatures.interrogation.available).toBe(false);
    expect(starterFeatures.interrogation.reason).toContain("Growth");

    const growthFeatures = buildFeatureAvailability({
      tier: "growth",
      blueprint_tier: "Growth",
      selected_blueprint_level: null,
      current_sequence_number: 24,
      sequences_completed_numbers: [23],
    });
    expect(growthFeatures.interrogation.available).toBe(true);
    expect(growthFeatures.predictions.available).toBe(false);
  });

  it("gates ultimate features for Ultimate tier only", () => {
    const ultimateOk = isFeatureAvailable(
      "ultimate",
      "Ultimate",
      null,
      [24],
      "predictions",
    );
    expect(ultimateOk).toBe(true);

    const growthBlocked = isFeatureAvailable(
      "growth",
      "Growth",
      null,
      [24],
      "predictions",
    );
    expect(growthBlocked).toBe(false);
  });

  it("returns tier navigation with growth/ultimate groups", () => {
    const nav = getTierNavItems("Growth", 24, [23]);
    const growthItems = nav.filter((n) => n.group === "growth");
    const ultimateItems = nav.filter((n) => n.group === "ultimate");
    expect(growthItems.some((n) => n.href === "/growth")).toBe(true);
    expect(growthItems.every((n) => !n.locked)).toBe(true);
    expect(ultimateItems.every((n) => n.locked)).toBe(true);

    const unlocked = getUnlockedTierNav("Ultimate", 25, [24]);
    expect(unlocked.some((n) => n.href === "/ultimate")).toBe(true);
  });

  it("tierMeetsRequirement blocks Growth on Starter", () => {
    expect(tierMeetsRequirement("Starter", "Growth")).toBe(false);
    expect(normalizeBlueprintTier(null, "ultimate")).toBe("Ultimate");
  });
});
