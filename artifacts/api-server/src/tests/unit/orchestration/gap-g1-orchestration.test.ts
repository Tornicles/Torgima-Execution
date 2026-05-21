/**
 * GAP PROMPT G1 — Cross-Engine Orchestration tests.
 */

import { describe, it, expect } from "vitest";
import {
  EventTypes,
  WorkerQueues,
  EVENT_QUEUE_MAP,
  TERMINAL_EVENT_TYPES,
  EVENT_CHAIN_CONTRACT,
  assertEventQueueContract,
} from "../../../types/eventContracts.js";
import { Workflows } from "../../../engines/orchestration/WorkflowDefinitions.js";
import { blueprintLockKey } from "../../../engines/orchestration/OrchestrationLock.js";
import { EVENT_TYPES } from "../../../services/EventService.js";
import { FEEDBACK_QUEUE } from "../../../workers/FeedbackWorker.js";
import { SIGNAL_QUEUE } from "../../../workers/SignalWorker.js";
import { CONDITION_QUEUE } from "../../../workers/ConditionWorker.js";
import { CONTROL_QUEUE } from "../../../workers/ControlWorker.js";
import { TASK_GENERATION_QUEUE } from "../../../workers/TaskGenerationWorker.js";
import { TASK_GUARANTEE_QUEUE } from "../../../workers/TaskGuaranteeWorker.js";

describe("GAP G1 — event contracts", () => {
  it("T1: EventService re-exports match EventTypes (zero drift)", () => {
    expect(EVENT_TYPES.FEEDBACK_SUBMITTED).toBe(EventTypes.FEEDBACK_SUBMITTED);
    expect(EVENT_TYPES.SIGNAL_CALCULATED).toBe(EventTypes.SIGNAL_CALCULATED);
    expect(EVENT_TYPES.ORDER_AVAILABLE).toBe(EventTypes.ORDER_AVAILABLE);
  });

  it("T1: emitter → worker chain has zero mismatches", () => {
    const { ok, mismatches } = assertEventQueueContract();
    expect(mismatches).toEqual([]);
    expect(ok).toBe(true);
    expect(EVENT_CHAIN_CONTRACT.length).toBeGreaterThanOrEqual(8);
  });

  it("worker queues align with EVENT_QUEUE_MAP targets", () => {
    expect(FEEDBACK_QUEUE).toBe(WorkerQueues.FEEDBACK_PROCESSING);
    expect(EVENT_QUEUE_MAP[EventTypes.FEEDBACK_SUBMITTED]).toBe(FEEDBACK_QUEUE);
    expect(EVENT_QUEUE_MAP[EventTypes.SIGNAL_CALCULATED]).toBe(CONDITION_QUEUE);
    expect(EVENT_QUEUE_MAP[EventTypes.CONDITION_EVALUATED]).toBe(CONTROL_QUEUE);
    expect(EVENT_QUEUE_MAP[EventTypes.ENFORCEMENT_PACKAGE_CREATED]).toBe(TASK_GENERATION_QUEUE);
    expect(EVENT_QUEUE_MAP[EventTypes.TASK_GENERATION_COMPLETED]).toBe(TASK_GUARANTEE_QUEUE);
    expect(SIGNAL_QUEUE).toBe(WorkerQueues.SIGNAL_RECALCULATION);
  });

  it("order_available is terminal (optional reward/identity do not block)", () => {
    expect(TERMINAL_EVENT_TYPES.has(EventTypes.ORDER_AVAILABLE)).toBe(true);
    expect(EVENT_QUEUE_MAP[EventTypes.REWARD_EVALUATION_REQUESTED]).toBe(
      WorkerQueues.REWARD_EVALUATION,
    );
    expect(EVENT_QUEUE_MAP[EventTypes.IDENTITY_EVALUATION_REQUESTED]).toBe(
      WorkerQueues.IDENTITY_EVALUATION,
    );
  });
});

describe("GAP G1 — workflow definitions", () => {
  it("feedback_completion workflow matches live chain event names", () => {
    const wf = Workflows.FEEDBACK_COMPLETION;
    expect(wf.lockScope).toBe("BLUEPRINT");
    const required = wf.steps.filter((s) => s.required).map((s) => s.emits);
    expect(required[0]).toBe(EventTypes.FEEDBACK_SUBMITTED);
    expect(required).toContain(EventTypes.ORDER_AVAILABLE);
    const optional = wf.steps.filter((s) => !s.required).map((s) => s.emits);
    expect(optional).toContain(EventTypes.REWARD_EVALUATION_REQUESTED);
    expect(optional).toContain(EventTypes.IDENTITY_EVALUATION_REQUESTED);
  });

  it("blueprint lock key format (T2 contract)", () => {
    expect(blueprintLockKey("bp-1", "feedback_completion")).toBe(
      "lock:blueprint:bp-1:feedback_completion",
    );
  });
});

describe("GAP G1 — feedback workflow sequence (T3 static)", () => {
  it("required steps appear in causal order in workflow definition", () => {
    const required = Workflows.FEEDBACK_COMPLETION.steps
      .filter((s) => s.required)
      .map((s) => s.emits);
    const expected = [
      EventTypes.FEEDBACK_SUBMITTED,
      EventTypes.SIGNAL_RECALCULATION_REQUESTED,
      EventTypes.SIGNAL_CALCULATED,
      EventTypes.CONDITION_EVALUATED,
      EventTypes.ENFORCEMENT_PACKAGE_CREATED,
      EventTypes.TASK_GENERATION_COMPLETED,
      EventTypes.ORDER_AVAILABLE,
      EventTypes.DASHBOARD_REFRESH_REQUESTED,
    ];
    expect(required).toEqual(expected);
  });
});
