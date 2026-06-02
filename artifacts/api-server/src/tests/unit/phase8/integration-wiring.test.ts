import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  applyPatternRulesToGeneration,
  isPatternActive,
  reduceDifficultyOneLevel,
  type ActivePatternRow,
} from "../../../engines/task-generation/taskGenerationIntelligence.js";
import {
  applyInactivityMomentumPenalty,
  isInactivityTriggerReason,
} from "../../../engines/signal/signalInactivityMomentum.js";
import {
  isAdvancingCondition,
  shouldHoldConditionForFatigue,
} from "../../../engines/condition/conditionFatigueHold.js";
import { EventTypes } from "../../../types/eventContracts.js";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
  },
  inactivityRecords: {},
}));

vi.mock("../../../engines/pattern/PatternLearningEngine.js", () => ({
  getActivePatterns: vi.fn(async () => [
    {
      id: "p1",
      pattern_type: "burnout",
      status: "active",
      severity: "high",
      evidence_json: { spec_label: "FATIGUE_RISK" },
    },
  ]),
}));

describe("Phase 8 integration wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("FATIGUE_RISK reduces difficulty cap one level", () => {
    const patterns = [
      {
        id: "1",
        pattern_type: "burnout",
        status: "active",
        evidence_json: { spec_label: "FATIGUE_RISK" },
      },
    ] as ActivePatternRow[];

    expect(isPatternActive(patterns, "FATIGUE_RISK")).toBeDefined();
    expect(reduceDifficultyOneLevel("medium")).toBe("easy");

    const weights = new Map([["execution", 1]]);
    const { difficultyCap } = applyPatternRulesToGeneration({
      intelligence: {
        activePatterns: patterns,
        frictionMap: {},
        avoidedTaskTypes: new Set(),
        recoverySuccessActive: false,
      },
      difficultyCap: "medium",
      taskTypeWeights: weights,
    });
    expect(difficultyCap).toBe("easy");
  });

  it("TASK_TYPE_AVOIDANCE deprioritizes task type (~70%)", () => {
    const patterns = [
      {
        id: "1",
        pattern_type: "avoidance",
        status: "active",
        evidence_json: {
          spec_label: "TASK_TYPE_AVOIDANCE",
          task_type: "research",
        },
      },
    ] as ActivePatternRow[];

    const weights = new Map([["research", 1], ["execution", 1]]);
    applyPatternRulesToGeneration({
      intelligence: {
        activePatterns: patterns,
        frictionMap: {},
        avoidedTaskTypes: new Set(),
        recoverySuccessActive: false,
      },
      difficultyCap: "easy",
      taskTypeWeights: weights,
    });
    expect(weights.get("research")).toBeCloseTo(0.3, 5);
  });

  it("inactivity trigger reason detected", () => {
    expect(isInactivityTriggerReason("inactivity")).toBe(true);
    expect(isInactivityTriggerReason("inactivity_high")).toBe(true);
    expect(isInactivityTriggerReason("feedback")).toBe(false);
  });

  it("applyInactivityMomentumPenalty returns base when no records", async () => {
    const m = await applyInactivityMomentumPenalty({
      blueprintId: "bp-1",
      momentum: 5,
      triggerReason: "inactivity",
    });
    expect(m).toBe(5);
  });

  it("isAdvancingCondition detects upward moves", () => {
    expect(isAdvancingCondition("urgency", "stability")).toBe(true);
    expect(isAdvancingCondition("stability", "urgency")).toBe(false);
    expect(isAdvancingCondition("stability", "power_change")).toBe(false);
  });

  it("shouldHoldConditionForFatigue when advancing with fatigue pattern", async () => {
    const hold = await shouldHoldConditionForFatigue({
      userId: "u1",
      blueprintId: "bp1",
      previousCondition: "urgency",
      proposedCondition: "stability",
    });
    expect(hold).toBe(true);
  });

  it("ADAPTATION_REQUESTED event type defined", () => {
    expect(EventTypes.ADAPTATION_REQUESTED).toBe("adaptation_requested");
  });
});
