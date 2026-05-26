import { describe, expect, it } from "vitest";
import {
  applyConditionExitHysteresis,
  assignConditionFromMetrics,
  determineConditionFromFrameworkSignals,
} from "../../../engines/condition/ConditionDeterminationEngine.js";
import { dailyTasksForCondition } from "../../../constants/conditionSpec.js";
import { CONDITIONS } from "../../../constants/conditions.js";

describe("ConditionDeterminationEngine (CONDITION_SYSTEM_SPECIFICATION)", () => {
  it("maps critical production to DANGER", () => {
    expect(
      determineConditionFromFrameworkSignals({
        production: 0.35,
        operations: 0.5,
        growth: 0.5,
        scale: 0.5,
      }),
    ).toBe(CONDITIONS.DANGER);
  });

  it("maps critical operations to DANGER", () => {
    expect(
      determineConditionFromFrameworkSignals({
        production: 0.5,
        operations: 0.28,
        growth: 0.5,
        scale: 0.5,
      }),
    ).toBe(CONDITIONS.DANGER);
  });

  it("maps negative momentum to DANGER", () => {
    expect(
      determineConditionFromFrameworkSignals({
        production: 0.5,
        operations: 0.5,
        growth: 0.5,
        scale: 0.5,
        momentum: -0.2,
      }),
    ).toBe(CONDITIONS.DANGER);
  });

  it("maps dual weak core signals to URGENCY", () => {
    expect(
      determineConditionFromFrameworkSignals({
        production: 0.65,
        operations: 0.55,
        growth: 0.6,
        scale: 0.7,
      }),
    ).toBe(CONDITIONS.URGENCY);
  });

  it("maps low growth to URGENCY", () => {
    expect(
      determineConditionFromFrameworkSignals({
        production: 0.75,
        operations: 0.75,
        growth: 0.45,
        scale: 0.7,
      }),
    ).toBe(CONDITIONS.URGENCY);
  });

  it("maps strong growth + momentum to POWER", () => {
    expect(
      determineConditionFromFrameworkSignals({
        production: 0.7,
        operations: 0.7,
        growth: 0.82,
        scale: 0.7,
        momentum: 0.12,
      }),
    ).toBe(CONDITIONS.POWER);
  });

  it("maps excellence pair to POWER", () => {
    expect(
      determineConditionFromFrameworkSignals({
        production: 0.88,
        operations: 0.78,
        growth: 0.6,
        scale: 0.7,
      }),
    ).toBe(CONDITIONS.POWER);
  });

  it("defaults balanced signals to STABILITY", () => {
    expect(
      determineConditionFromFrameworkSignals({
        production: 0.78,
        operations: 0.65,
        growth: 0.55,
        scale: 0.78,
      }),
    ).toBe(CONDITIONS.STABILITY);
  });

  it("exposes spec daily task caps", () => {
    expect(dailyTasksForCondition("danger")).toBe(3);
    expect(dailyTasksForCondition("urgency")).toBe(6);
    expect(dailyTasksForCondition("stability")).toBe(9);
    expect(dailyTasksForCondition("power")).toBe(12);
  });

  it("holds DANGER until exit thresholds met (hysteresis)", () => {
    const proposed = CONDITIONS.STABILITY;
    const held = applyConditionExitHysteresis(
      CONDITIONS.DANGER,
      proposed,
      { production: 0.45, operations: 0.35, growth: 0.5, scale: 0.6, momentum: -0.05 },
    );
    expect(held).toBe(CONDITIONS.DANGER);

    const stepped = applyConditionExitHysteresis(
      CONDITIONS.DANGER,
      proposed,
      { production: 0.55, operations: 0.45, growth: 0.5, scale: 0.6, momentum: 0.02 },
    );
    expect(stepped).toBe(CONDITIONS.URGENCY);
  });

  it("holds URGENCY until stability exit thresholds met", () => {
    const held = applyConditionExitHysteresis(
      CONDITIONS.URGENCY,
      CONDITIONS.STABILITY,
      { production: 0.68, operations: 0.65, growth: 0.55, scale: 0.75, momentum: 0.01 },
      { blockerCount: 3 },
    );
    expect(held).toBe(CONDITIONS.URGENCY);
  });

  it("assigns nothingness for insufficient data", () => {
    const c = assignConditionFromMetrics(
      {
        completion_rate: 0,
        weighted_score: 0,
        momentum: 0,
        trend: "flat",
        confidence: "insufficient_data",
        tasks_in_window: 0,
        blocker_ratio: 0,
        skip_ratio: 0,
        raw_score: 0,
        avg_difficulty_felt: null,
      },
      "stability",
    );
    expect(c).toBe(CONDITIONS.NOTHINGNESS);
  });
});
