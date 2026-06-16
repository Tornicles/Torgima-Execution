/**
 * DOC23 — Decision trace and cognitive load tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DOC23_DECISION_TYPES,
  DecisionTraceService,
} from "../../../engines/decision/DecisionTraceService.js";
import {
  scoreCognitiveLoad,
} from "../../../engines/decision/CognitiveLoadScorer.js";

describe("decision-trace", () => {
  it("accepts all 7 DOC23 decision types", () => {
    expect(DOC23_DECISION_TYPES).toHaveLength(7);
    expect(DOC23_DECISION_TYPES).toContain("SYSTEM_CORRECTION");
    expect(DOC23_DECISION_TYPES).toContain("AI_ASSISTED");
    expect(DOC23_DECISION_TYPES).toContain("ADMIN_REPAIR");
  });

  it("TEST 1: DecisionTraceService.write validates and persists", async () => {
    vi.resetModules();
    const insertMock = vi.fn().mockResolvedValue([{ id: "trace-1" }]);
    vi.doMock("@workspace/db", () => ({
      db: {
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: insertMock })) })),
      },
      decisionTraces: {},
    }));
    vi.doMock("../../../services/EventService.js", () => ({
      writeEvent: vi.fn().mockResolvedValue("evt-1"),
      EVENT_TYPES: { COGNITIVE_LOAD_EVALUATION_REQUESTED: "cognitive_load_evaluation_requested" },
    }));

    const { DecisionTraceService: Svc } = await import(
      "../../../engines/decision/DecisionTraceService.js"
    );

    const id = await Svc.write({
      userId: "user-1",
      blueprintId: "bp-1",
      decisionType: "SYSTEM_CONTROL",
      decisionKey: "test:decision",
      selectedOption: "execution",
      optionsConsidered: ["execution", "recovery"],
      rationaleSummary: "Selected execution under stability",
      sourceEngine: "TestEngine",
      confidence: "HIGH",
      stateVersion: 3,
    });

    expect(id).toBe("trace-1");
    expect(insertMock).toHaveBeenCalled();
  });

  it("TEST 2: CRITICAL load score triggers CRITICAL level", () => {
    const assessment = scoreCognitiveLoad({
      choiceCount: 12,
      unresolvedDecisionCount: 6,
      reversalCount: 4,
      ambiguityCount: 3,
      frictionScoreAverage: 75,
      condition: "danger",
      taskComplexity: "very_hard",
    });
    expect(assessment.score).toBeGreaterThanOrEqual(80);
    expect(assessment.level).toBe("CRITICAL");
  });

  it("TEST 3: low choice count yields LOW load without simplification events", async () => {
    const assessment = scoreCognitiveLoad({
      choiceCount: 2,
      unresolvedDecisionCount: 0,
      reversalCount: 0,
      ambiguityCount: 0,
      frictionScoreAverage: 20,
      condition: "stability",
      taskComplexity: "easy",
    });
    expect(assessment.score).toBeLessThan(35);
    expect(assessment.level).toBe("LOW");

    const writeEventMock = vi.fn().mockResolvedValue("evt-1");
    vi.doMock("../../../services/EventService.js", () => ({
      writeEvent: writeEventMock,
      EVENT_TYPES: {
        COGNITIVE_LOAD_HIGH: "cognitive_load_high",
        CLARIFICATION_TASK_REQUESTED: "clarification_task_requested",
        REDUCE_DECISION_BURDEN_REQUESTED: "reduce_decision_burden_requested",
        CONDITION_EVALUATION_REQUESTED: "condition_evaluation_requested",
      },
    }));
    const { applySimplification: apply } = await import(
      "../../../engines/decision/SimplificationEngine.js"
    );
    await apply({
      userId: "user-1",
      blueprintId: "bp-1",
      loadLevel: "LOW",
      loadScore: assessment.score,
    });
    expect(writeEventMock).not.toHaveBeenCalled();
  });

  it("TEST 4: loadRecent returns ordered traces with limit", async () => {
    vi.resetModules();
    const rows = [
      { id: "t3", created_at: new Date("2026-06-14T12:00:00Z") },
      { id: "t2", created_at: new Date("2026-06-13T12:00:00Z") },
      { id: "t1", created_at: new Date("2026-06-12T12:00:00Z") },
    ];
    vi.doMock("@workspace/db", () => ({
      db: {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue(rows.slice(0, 2)),
              })),
            })),
          })),
        })),
      },
      decisionTraces: {},
    }));

    const { DecisionTraceService: Svc } = await import(
      "../../../engines/decision/DecisionTraceService.js"
    );
    const recent = await Svc.loadRecent("user-1", "bp-1", 2);
    expect(recent).toHaveLength(2);
    expect(recent[0]?.id).toBe("t3");
  });

  it("rejects invalid decision types", async () => {
    await expect(
      DecisionTraceService.write({
        userId: "user-1",
        blueprintId: "bp-1",
        decisionType: "INVALID" as "SYSTEM_CONTROL",
        decisionKey: "bad",
        selectedOption: "x",
        optionsConsidered: [],
        rationaleSummary: "bad",
        sourceEngine: "Test",
      }),
    ).rejects.toThrow("INVALID_DECISION_TYPE");
  });

  it("CRITICAL simplification respects enforcement minimum of 1 action", async () => {
    const writeEventMock = vi.fn().mockResolvedValue("evt-1");
    vi.doMock("../../../services/EventService.js", () => ({
      writeEvent: writeEventMock,
      EVENT_TYPES: {
        REDUCE_DECISION_BURDEN_REQUESTED: "reduce_decision_burden_requested",
        CONDITION_EVALUATION_REQUESTED: "condition_evaluation_requested",
      },
    }));
    const { applySimplification: apply } = await import(
      "../../../engines/decision/SimplificationEngine.js"
    );
    await apply({
      userId: "user-1",
      blueprintId: "bp-1",
      loadLevel: "CRITICAL",
      loadScore: 90,
      enforcementTaskMin: 2,
    });
    const burdenCall = writeEventMock.mock.calls.find(
      (c) => c[0]?.eventType === "reduce_decision_burden_requested",
    );
    expect(burdenCall?.[0]?.payload?.max_visible_actions).toBe(2);
    expect(burdenCall?.[0]?.payload?.enforcement_respected).toBe(true);
  });
});

describe("decision-trace — score formula components", () => {
  it("caps choice contribution at 30 points", () => {
    const low = scoreCognitiveLoad({
      choiceCount: 5,
      unresolvedDecisionCount: 0,
      reversalCount: 0,
      ambiguityCount: 0,
      frictionScoreAverage: 0,
      condition: null,
      taskComplexity: null,
    });
    const high = scoreCognitiveLoad({
      choiceCount: 15,
      unresolvedDecisionCount: 0,
      reversalCount: 0,
      ambiguityCount: 0,
      frictionScoreAverage: 0,
      condition: null,
      taskComplexity: null,
    });
    expect(high.score - low.score).toBeLessThanOrEqual(30);
  });
});
