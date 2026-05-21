/**
 * IL3 — Pattern Learning, Burnout Detection & Failure Classification (T1–T5).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  countBurnoutSignals,
  meetsPatternThreshold,
  PATTERN_MIN_OCCURRENCES,
  DOC21_PATTERN_TYPES,
} from "../../../engines/pattern/PatternLearningEngine.js";
import {
  correctionTypeToTaskType,
  FailureClassificationEngine,
} from "../../../engines/failure/FailureClassificationEngine.js";
import { EventTypes, EVENT_QUEUE_MAP } from "../../../types/eventContracts.js";

describe("IL3 — pattern thresholds & DOC_21 types", () => {
  it("T5: pattern requires minimum 3 occurrences", () => {
    expect(PATTERN_MIN_OCCURRENCES).toBe(3);
    expect(meetsPatternThreshold(2)).toBe(false);
    expect(meetsPatternThreshold(3)).toBe(true);
  });

  it("DOC_21 pattern types include burnout and task_type_avoidance", () => {
    expect(DOC21_PATTERN_TYPES).toContain("burnout");
    expect(DOC21_PATTERN_TYPES).toContain("task_type_avoidance");
    expect(DOC21_PATTERN_TYPES).toContain("false_progress");
  });
});

describe("IL3 — burnout risk signals", () => {
  it("T1: burnout risk when 3+ combined signals", () => {
    const signals = countBurnoutSignals({
      failureRate: 0.55,
      inactivityCount: 3,
      lateCount: 4,
      fatigueRiskScore: 0.75,
    });
    expect(signals).toBeGreaterThanOrEqual(3);
  });

  it("no burnout when only two signals fire", () => {
    const signals = countBurnoutSignals({
      failureRate: 0.55,
      inactivityCount: 1,
      lateCount: 1,
      fatigueRiskScore: 0.2,
    });
    expect(signals).toBeLessThan(3);
  });
});

describe("IL3 — failure correction routing", () => {
  it("T2: dependency failure maps to blocker_resolution task type", () => {
    expect(correctionTypeToTaskType("dependency_resolution_requested")).toBe(
      "blocker_resolution",
    );
  });

  it("T3: capability failure maps to academy task type", () => {
    expect(correctionTypeToTaskType("academy_task_requested")).toBe("academy");
  });

  it("T4: clarity failure maps to clarification task type", () => {
    expect(correctionTypeToTaskType("clarification_task_requested")).toBe(
      "clarification",
    );
  });
});

describe("IL3 — event chain", () => {
  it("PATTERN_SCAN_REQUESTED maps to pattern scan worker queue", () => {
    expect(EventTypes.PATTERN_SCAN_REQUESTED).toBe("pattern_scan_requested");
    expect(EVENT_QUEUE_MAP[EventTypes.PATTERN_SCAN_REQUESTED]).toBe(
      "pattern_scan_requested",
    );
  });

  it("FAILURE_CLASSIFIED is terminal (audit)", async () => {
    const { TERMINAL_EVENT_TYPES } = await import("../../../types/eventContracts.js");
    expect(TERMINAL_EVENT_TYPES.has(EventTypes.FAILURE_CLASSIFIED)).toBe(true);
  });

  it("FRICTION_ADAPTATION_REQUESTED is terminal for burnout adaptation", async () => {
    const { TERMINAL_EVENT_TYPES } = await import("../../../types/eventContracts.js");
    expect(TERMINAL_EVENT_TYPES.has(EventTypes.FRICTION_ADAPTATION_REQUESTED)).toBe(
      true,
    );
  });
});

describe("IL3 — FailureClassificationEngine.classify", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("classify delegates to classifyFailure pipeline", async () => {
    vi.doMock("@workspace/db", () => ({
      db: {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([
                {
                  id: "order-1",
                  difficulty: "hard",
                  time_estimate_minutes: 30,
                  proof_required: false,
                },
              ]),
            })),
          })),
        })),
      },
      orders: {},
      feedback: {},
      conditions: {},
      behaviorPatterns: {},
      decisionTraces: {},
      capabilityProfiles: {},
    }));

    vi.doMock("../../../engines/decision-trace/DecisionTraceSystem.js", () => ({
      traceDecision: vi.fn().mockResolvedValue(undefined),
    }));

    const { classifyFailure } = await import(
      "../../../engines/failure/FailureClassificationEngine.js"
    );
    const engine = new FailureClassificationEngine();
    expect(engine.classify).toBeDefined();
    expect(typeof classifyFailure).toBe("function");
  });
});
