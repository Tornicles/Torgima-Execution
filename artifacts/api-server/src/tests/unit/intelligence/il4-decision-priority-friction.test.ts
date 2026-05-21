/**
 * IL4 — Decision Trace, Priority Engine & Friction Detection (T1–T5).
 */

import { describe, it, expect } from "vitest";
import {
  PriorityEngine,
  scorePriorityCandidate,
} from "../../../engines/priority/PriorityEngine.js";
import { IL4_DECISION_TYPES } from "../../../engines/decision-trace/DecisionTraceSystem.js";
import { EventTypes, TERMINAL_EVENT_TYPES } from "../../../types/eventContracts.js";
import { FRICTION_TYPES } from "../../../engines/friction/FrictionDetectionEngine.js";

describe("IL4 — PriorityEngine", () => {
  const engine = new PriorityEngine();
  const ctxDanger = {
    condition: "danger",
    capability: { difficulty_recommendation: "easy" as const },
    falseProgressActive: false,
  };
  const ctxStability = {
    condition: "stability",
    capability: { difficulty_recommendation: "moderate" as const },
    falseProgressActive: false,
  };

  it("T2: blocker_resolution beats execution in danger", () => {
    const best = engine.score(
      [
        { task_type: "execution" },
        { task_type: "blocker_resolution" },
      ],
      ctxDanger,
    );
    expect(best.task_type).toBe("blocker_resolution");
  });

  it("T3: execution beats recovery in stability", () => {
    const best = engine.score(
      [
        { task_type: "recovery" },
        { task_type: "execution" },
      ],
      ctxStability,
    );
    expect(best.task_type).toBe("execution");
  });

  it("T5: single candidate returns without comparative loss", () => {
    const only = engine.score([{ id: "o1", task_type: "academy" }], ctxStability);
    expect(only.task_type).toBe("academy");
    expect(scorePriorityCandidate({ task_type: "academy" }, ctxStability)).toBeGreaterThan(0);
  });

  it("penalizes execution when false progress active", () => {
    const execScore = scorePriorityCandidate(
      { task_type: "execution" },
      { ...ctxStability, falseProgressActive: true },
    );
    const blockerScore = scorePriorityCandidate(
      { task_type: "blocker_resolution" },
      { ...ctxStability, falseProgressActive: true },
    );
    expect(blockerScore).toBeGreaterThan(execScore);
  });
});

describe("IL4 — decision trace types", () => {
  it("defines IL4 audit decision types", () => {
    expect(IL4_DECISION_TYPES.CONTROL_OUTPUT).toBe("CONTROL_OUTPUT");
    expect(IL4_DECISION_TYPES.FAILURE_ROUTING).toBe("FAILURE_ROUTING");
    expect(IL4_DECISION_TYPES.PRIORITY_SELECTION).toBe("PRIORITY_SELECTION");
  });

  it("T1: FAILURE_CLASSIFIED and FRICTION_ADAPTATION are terminal audit events", () => {
    expect(TERMINAL_EVENT_TYPES.has(EventTypes.FAILURE_CLASSIFIED)).toBe(true);
    expect(TERMINAL_EVENT_TYPES.has(EventTypes.FRICTION_ADAPTATION_REQUESTED)).toBe(true);
  });
});

describe("IL4 — friction types", () => {
  it("T4: friction catalog includes TIME and DIFFICULTY", () => {
    expect(FRICTION_TYPES).toContain("TIME_FRICTION");
    expect(FRICTION_TYPES).toContain("DIFFICULTY_FRICTION");
    expect(FRICTION_TYPES).toContain("MOTIVATION_FRICTION");
  });
});
