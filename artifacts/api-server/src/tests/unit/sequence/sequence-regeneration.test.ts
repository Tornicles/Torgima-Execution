import { describe, expect, it } from "vitest";
import { CONDITIONS } from "../../../constants/conditions.js";
import {
  determineConditionFromFrameworkSignals,
  normalizeFrameworkSignals,
} from "../../../engines/condition/ConditionDeterminationEngine.js";

function determineCondition(signals: Record<string, number>): string {
  return determineConditionFromFrameworkSignals(normalizeFrameworkSignals(signals));
}

describe("Sequence regeneration condition (CONDITION_SYSTEM_SPECIFICATION)", () => {
  it("maps weak production to danger", () => {
    expect(determineCondition({ Production: 0.2, Operations: 0.5, Growth: 0.5, Scale: 0.5 })).toBe(
      CONDITIONS.DANGER,
    );
  });

  it("maps dual weak core signals to urgency", () => {
    expect(determineCondition({ Production: 0.65, Operations: 0.55, Growth: 0.6, Scale: 0.7 })).toBe(
      CONDITIONS.URGENCY,
    );
  });

  it("maps strong growth + momentum to power", () => {
    expect(
      determineCondition({
        Production: 0.7,
        Operations: 0.7,
        Growth: 0.82,
        Scale: 0.7,
        momentum: 0.12,
      }),
    ).toBe(CONDITIONS.POWER);
  });

  it("defaults to stability for balanced signals", () => {
    expect(determineCondition({ Production: 0.78, Operations: 0.65, Growth: 0.55, Scale: 0.78 })).toBe(
      CONDITIONS.STABILITY,
    );
  });
});
