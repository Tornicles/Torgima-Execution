/**
 * DOC28 — System orchestration tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventTypes } from "../../../types/eventContracts.js";
import {
  WORKFLOWS,
  requiredCoreSteps,
  optionalSteps,
} from "../../../engines/orchestration/WorkflowRegistry.js";
import {
  CONFLICT_RULES,
  resolveConflictRules,
  resolveTaskGenerationConflict,
} from "../../../engines/orchestration/ConflictResolver.js";
import {
  LockManager,
  hashToInt,
  advisoryLockKey,
} from "../../../engines/orchestration/LockManager.js";
import {
  feedbackCompletionEventChain,
  optionalStepsDoNotBlockGuarantee,
} from "../../../engines/orchestration/OrchestrationService.js";
import {
  evaluateStuckFeedbackLoop,
  evaluateLockStarvation,
  STUCK_WORKFLOW_THRESHOLD_MS,
  LOCK_STARVATION_THRESHOLD_MS,
} from "../../../engines/orchestration/OrchestrationHealthMonitor.js";

describe("orchestration", () => {
  it("TEST 1: FEEDBACK_COMPLETION required steps fire in causal order", () => {
    const chain = feedbackCompletionEventChain();
    expect(chain[0]).toBe(EventTypes.SIGNAL_CALCULATED);
    expect(chain).toContain(EventTypes.CONDITION_EVALUATED);
    expect(chain).toContain(EventTypes.ENFORCEMENT_PACKAGE_CREATED);
    expect(chain).toContain(EventTypes.TASK_GENERATION_COMPLETED);
    expect(chain).toContain(EventTypes.DEPENDENCY_CHECK_REQUESTED);
    expect(chain[chain.length - 1]).toBe(EventTypes.ORDER_AVAILABLE);

    const signalIdx = chain.indexOf(EventTypes.SIGNAL_CALCULATED);
    const orderIdx = chain.indexOf(EventTypes.ORDER_AVAILABLE);
    expect(orderIdx).toBeGreaterThan(signalIdx);
  });

  it("TEST 2: BLUEPRINT advisory lock key is stable per scope+entity", () => {
    const keyA = advisoryLockKey("BLUEPRINT", "bp-1");
    const keyB = advisoryLockKey("BLUEPRINT", "bp-1");
    const keyC = advisoryLockKey("BLUEPRINT", "bp-2");
    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
    expect(hashToInt(keyA)).toBe(hashToInt(keyA));
    expect(LockManager.lockKey("BLUEPRINT", "bp-1")).toBe("BLUEPRINT:bp-1");
  });

  it("TEST 3: Control beats Task Generation — blocked scaling reroutes task type", () => {
    const rules = resolveConflictRules({
      enforcementBlockedActions: ["scaling", "execution_scaling"],
      proposedTaskType: "scaling_execution",
    });
    const controlRule = rules.find((r) => r.rule === "CONTROL_BEATS_TASK_GENERATION");
    expect(controlRule?.applied).toBe(true);

    const decision = resolveTaskGenerationConflict({
      enforcementBlockedActions: ["scaling"],
      proposedTaskType: "scaling",
    });
    expect(decision.allowedTaskType).toBe("recovery");
  });

  it("TEST 4: Task guarantee fires when priority fails or queue is empty", () => {
    const priorityStep = WORKFLOWS.FEEDBACK_COMPLETION.steps.find(
      (s) => s.stepName === "priority_selection",
    );
    expect(priorityStep?.required).toBe(false);
    expect(priorityStep?.fallbackStep).toBe("skip_to_guarantee");

    const guaranteeStep = requiredCoreSteps(WORKFLOWS.FEEDBACK_COMPLETION).find(
      (s) => s.stepName === "task_guarantee",
    );
    expect(guaranteeStep?.required).toBe(true);
    expect(WORKFLOWS.FEEDBACK_COMPLETION.terminalEvents).toContain(EventTypes.ORDER_AVAILABLE);

    const decision = resolveTaskGenerationConflict({
      priorityEngineFailed: true,
      queueEmpty: true,
      activeBlueprint: true,
    });
    expect(decision.forceGuarantee).toBe(true);
    expect(decision.allowedTaskType).toBe("recovery");

    expect(optionalStepsDoNotBlockGuarantee(WORKFLOWS.FEEDBACK_COMPLETION)).toBe(true);
  });

  it("TEST 5: stuck workflow detected after 60s without order_available", () => {
    const now = new Date("2026-06-14T12:00:00.000Z");
    const feedbackAt = new Date(now.getTime() - 90_000);

    const finding = evaluateStuckFeedbackLoop({
      feedbackProcessedAt: feedbackAt,
      lastOrderAvailableAt: null,
      blueprintId: "bp-stuck",
      now,
    });

    expect(finding).not.toBeNull();
    expect(finding?.kind).toBe("stuck_workflow");
    if (finding?.kind === "stuck_workflow") {
      expect(finding.secondsSinceTrigger).toBeGreaterThanOrEqual(
        STUCK_WORKFLOW_THRESHOLD_MS / 1000,
      );
    }

    const healthy = evaluateStuckFeedbackLoop({
      feedbackProcessedAt: feedbackAt,
      lastOrderAvailableAt: new Date(feedbackAt.getTime() + 5_000),
      blueprintId: "bp-ok",
      now,
    });
    expect(healthy).toBeNull();
  });
});

describe("orchestration — registry and conflict coverage", () => {
  it("defines 3 canonical workflows with lock scopes", () => {
    expect(Object.keys(WORKFLOWS)).toEqual([
      "FEEDBACK_COMPLETION",
      "INACTIVITY_DETECTION",
      "FAILURE_CORRECTION",
    ]);
    expect(WORKFLOWS.FEEDBACK_COMPLETION.lockScope).toBe("BLUEPRINT");
    expect(WORKFLOWS.INACTIVITY_DETECTION.lockScope).toBe("USER");
    expect(WORKFLOWS.FAILURE_CORRECTION.lockScope).toBe("BLUEPRINT");
  });

  it("implements all 8 conflict resolution rules", () => {
    expect(CONFLICT_RULES).toHaveLength(8);
    expect(resolveConflictRules({})).toHaveLength(8);
  });

  it("detects lock starvation after 120 seconds", () => {
    const now = new Date("2026-06-14T12:00:00.000Z");
    const lockAt = new Date(now.getTime() - LOCK_STARVATION_THRESHOLD_MS - 1_000);
    const finding = evaluateLockStarvation({
      lockCreatedAt: lockAt,
      blueprintId: "bp-lock",
      lockKey: "lock:blueprint:bp-lock:feedback_completion_loop",
      now,
    });
    expect(finding?.kind).toBe("lock_starvation");
  });
});

describe("orchestration — LockManager advisory acquire", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns true for NONE scope without DB call", async () => {
    expect(await LockManager.acquire("NONE", "any")).toBe(true);
  });
});
