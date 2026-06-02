/**
 * Phase 6 / DOC 28 — OrchestrationService, locks, workflows, worker catalog.
 */

import { describe, it, expect } from "vitest";
import {
  ENGINE_OWNERSHIP,
  CONFLICT_PRECEDENCE,
  resolveConflictFromPrecedence,
  LOCK_MAX_TTL_SECONDS,
  LOCK_ACQUIRE_WAIT_MS,
} from "../../../services/OrchestrationService.js";
import { lockKey, LOCK_MAX_TTL_SECONDS as LOCK_TTL } from "../../../engines/orchestration/OrchestrationLock.js";
import { Workflows } from "../../../engines/orchestration/WorkflowDefinitions.js";
import { WORKER_CATALOG, workerRegistry } from "../../../workers/WorkerRegistry.js";
import { EventTypes } from "../../../types/eventContracts.js";
import { WorkerQueues } from "../../../types/eventContracts.js";

describe("Phase 6 — OrchestrationService constants", () => {
  it("declares ENGINE_OWNERSHIP for all coordinated engines", () => {
    expect(ENGINE_OWNERSHIP.FeedbackProcessing).toContain("Feedback");
    expect(ENGINE_OWNERSHIP.PriorityEngine).toContain("scoring");
    expect(ENGINE_OWNERSHIP.BhudhiRouter).toContain("AI");
    expect(Object.keys(ENGINE_OWNERSHIP).length).toBeGreaterThanOrEqual(14);
  });

  it("declares CONFLICT_PRECEDENCE with 5 rules in order", () => {
    expect(CONFLICT_PRECEDENCE).toHaveLength(5);
    expect(CONFLICT_PRECEDENCE[0]!.winner).toBe("ControlEngine");
    expect(CONFLICT_PRECEDENCE[1]!.winner).toBe("DependencyEngine");
    expect(CONFLICT_PRECEDENCE[2]!.winner).toBe("OutcomeValidation");
  });

  it("resolves ControlEngine over TaskGeneration", () => {
    const d = resolveConflictFromPrecedence("ControlEngine", "TaskGeneration");
    expect(d.winner).toBe("ControlEngine");
    expect(d.reason).toContain("enforcement");
  });

  it("lock TTL is 30 seconds max", () => {
    expect(LOCK_MAX_TTL_SECONDS).toBe(30);
    expect(LOCK_TTL).toBe(30);
    expect(LOCK_ACQUIRE_WAIT_MS).toBe(5000);
  });
});

describe("Phase 6 — lock keys", () => {
  it("BLUEPRINT lock key includes workflow name", () => {
    expect(lockKey("BLUEPRINT", "bp-1", "feedback_completion")).toBe(
      "lock:blueprint:bp-1:feedback_completion",
    );
  });

  it("ORDER lock key prevents duplicate feedback", () => {
    expect(lockKey("ORDER", "order-99")).toBe("lock:order:order-99");
  });
});

describe("Phase 6 — canonical workflows", () => {
  it("feedback_completion ends with dashboard refresh before async steps", () => {
    const required = Workflows.FEEDBACK_COMPLETION.steps
      .filter((s) => s.required)
      .map((s) => s.emits);
    const dashIdx = required.indexOf(EventTypes.DASHBOARD_REFRESH_REQUESTED);
    const orderIdx = required.indexOf(EventTypes.ORDER_AVAILABLE);
    expect(orderIdx).toBeGreaterThan(-1);
    expect(dashIdx).toBeGreaterThan(orderIdx);
  });

  it("failure_blocker workflow exists with classification + guarantee", () => {
    const wf = Workflows.FAILURE_BLOCKER;
    expect(wf.lockScope).toBe("ORDER");
    const emits = wf.steps.map((s) => s.emits);
    expect(emits).toContain(EventTypes.FAILURE_CLASSIFICATION_REQUESTED);
    expect(emits).toContain(EventTypes.ORDER_AVAILABLE);
  });

  it("inactivity_response requires order_available", () => {
    const required = Workflows.INACTIVITY_RESPONSE.steps
      .filter((s) => s.required)
      .map((s) => s.emits);
    expect(required).toContain(EventTypes.ORDER_AVAILABLE);
  });
});

describe("Phase 6 — worker catalog", () => {
  it("catalog includes Phase 1–4 workers", () => {
    const names = WORKER_CATALOG.map((w) => w.name);
    expect(names).toContain("FeedbackWorker");
    expect(names).toContain("InactivityWorker");
    expect(names).toContain("FailureWorker");
    expect(names).toContain("PatternScanWorker");
    expect(names).toContain("IdentityWorker");
    expect(names).toContain("RewardWorker");
  });

  it("catalog queues match WorkerQueues constants", () => {
    const feedback = WORKER_CATALOG.find((w) => w.name === "FeedbackWorker");
    expect(feedback?.queue).toBe(WorkerQueues.FEEDBACK_PROCESSING);
    const failure = WORKER_CATALOG.find((w) => w.name === "FailureWorker");
    expect(failure?.queue).toBe(WorkerQueues.FAILURE_CLASSIFICATION);
  });

  it("workerRegistry exposes getRegistered", () => {
    expect(typeof workerRegistry.getRegistered).toBe("function");
  });
});

describe("Phase 6 — orchestration lock timeout event", () => {
  it("ORCHESTRATION_LOCK_TIMEOUT is defined", () => {
    expect(EventTypes.ORCHESTRATION_LOCK_TIMEOUT).toBe("orchestration_lock_timeout");
  });
});
