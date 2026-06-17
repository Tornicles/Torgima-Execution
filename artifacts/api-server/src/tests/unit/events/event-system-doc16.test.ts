/**
 * DOC16 — Event System and Dead Letter Queue tests.
 */

import { describe, it, expect } from "vitest";
import {
  RETRY_POLICIES,
  getBackoffDelayMs,
  getMaxRetriesForPolicy,
  getNextRunAfterForPolicy,
  shouldDeadLetter,
} from "../../../workers/RetryPolicy.js";
import {
  WORKER_REGISTRY,
  getWorkerForEventType,
  listDoc16Workers,
} from "../../../workers/WorkerRegistry.js";
import {
  resolveWorkerForEvent,
  getWorkerHealthSnapshot,
} from "../../../workers/WorkerDispatcher.js";
import { CRITICAL_EVENTS, DOC16_CRITICAL_EVENTS } from "../../../workers/DeadLetterHandler.js";
import { resolveIdempotencyKey, buildEventIdempotencyKey } from "../../../lib/events/EventEmitter.js";
import { EventTypes } from "../../../types/eventContracts.js";

/** DOC16 baseline worker set (Prompt 8 adds lifecycle extensions on top). */
const DOC16_CORE_WORKER_NAMES = [
  "FeedbackWorker",
  "SignalWorker",
  "ConditionWorker",
  "ControlWorker",
  "TaskGenerationWorker",
  "TaskGuaranteeWorker",
  "InactivityWorker",
  "ProjectionWorker",
  "BhudhiWorker",
  "HealthWorker",
  "ErectorSignalBridgeWorker",
  "ErectorSimulationSignalWorker",
] as const;

const LIFECYCLE_EXTENSION_WORKERS = [
  {
    name: "ErectorBaselineWorker",
    consumes: EventTypes.ERECTOR_BASELINE_REQUESTED,
  },
  {
    name: "BlueprintExecutionGenerationWorker",
    consumes: EventTypes.BLUEPRINT_EXECUTION_GENERATION_REQUESTED,
  },
] as const;

describe("event-system — worker registry", () => {
  it("T1: registers all 12 DOC16 core workers plus lifecycle extensions", () => {
    const registered = listDoc16Workers();
    expect(registered.length).toBe(Object.keys(WORKER_REGISTRY).length);
    expect(registered.length).toBeGreaterThanOrEqual(DOC16_CORE_WORKER_NAMES.length);

    for (const name of DOC16_CORE_WORKER_NAMES) {
      expect(WORKER_REGISTRY[name], `missing DOC16 worker ${name}`).toBeDefined();
    }

    for (const ext of LIFECYCLE_EXTENSION_WORKERS) {
      const worker = WORKER_REGISTRY[ext.name];
      expect(worker, `missing lifecycle worker ${ext.name}`).toBeDefined();
      expect(worker?.consumes).toContain(ext.consumes);
    }

    expect(WORKER_REGISTRY.FeedbackWorker.consumes).toContain(EventTypes.FEEDBACK_SUBMITTED);
    expect(WORKER_REGISTRY.TaskGuaranteeWorker.retryPolicy).toBe("CRITICAL");
    expect(WORKER_REGISTRY.BhudhiWorker.retryPolicy).toBe("BHUDHI");
  });

  it("maps feedback_submitted to FeedbackWorker", () => {
    const worker = getWorkerForEventType(EventTypes.FEEDBACK_SUBMITTED);
    expect(worker?.name).toBe("FeedbackWorker");
    expect(resolveWorkerForEvent(EventTypes.FEEDBACK_SUBMITTED)?.retryPolicy).toBe("STANDARD");
  });

  it("health snapshot includes retry metadata for every registered worker", () => {
    const snapshot = getWorkerHealthSnapshot();
    expect(snapshot).toHaveLength(Object.keys(WORKER_REGISTRY).length);
    expect(snapshot.length).toBeGreaterThanOrEqual(DOC16_CORE_WORKER_NAMES.length);
    for (const name of DOC16_CORE_WORKER_NAMES) {
      expect(snapshot.find((w) => w.name === name), `missing snapshot for ${name}`).toBeDefined();
    }
    expect(snapshot.find((w) => w.name === "TaskGuaranteeWorker")?.maxRetries).toBe(5);
    expect(snapshot.find((w) => w.name === "ErectorBaselineWorker")?.consumes).toContain(
      EventTypes.ERECTOR_BASELINE_REQUESTED,
    );
    expect(snapshot.find((w) => w.name === "BlueprintExecutionGenerationWorker")?.consumes).toContain(
      EventTypes.BLUEPRINT_EXECUTION_GENERATION_REQUESTED,
    );
  });
});

describe("event-system — retry policies", () => {
  it("T2: STANDARD policy uses DOC16 backoff values", () => {
    expect(RETRY_POLICIES.STANDARD).toEqual({
      maxRetries: 3,
      backoffMs: [1000, 3000, 9000],
    });
    expect(getBackoffDelayMs("STANDARD", 0)).toBe(1000);
    expect(getBackoffDelayMs("STANDARD", 1)).toBe(3000);
    expect(getBackoffDelayMs("STANDARD", 2)).toBe(9000);
  });

  it("implements all 4 named policies", () => {
    expect(getMaxRetriesForPolicy("CRITICAL")).toBe(5);
    expect(getMaxRetriesForPolicy("FAST")).toBe(2);
    expect(getMaxRetriesForPolicy("BHUDHI")).toBe(1);
    expect(getNextRunAfterForPolicy("FAST", 0).getTime()).toBeGreaterThan(Date.now());
  });

  it("T2: dead letters after STANDARD max retries exceeded", () => {
    expect(shouldDeadLetter("STANDARD", 3)).toBe(false);
    expect(shouldDeadLetter("STANDARD", 4)).toBe(true);
  });
});

describe("event-system — idempotency", () => {
  it("T3: stable idempotency key format event_type:entity_id", () => {
    expect(buildEventIdempotencyKey("feedback_submitted", "order-1")).toBe(
      "feedback_submitted:order-1",
    );
  });

  it("T3: resolveIdempotencyKey prefers explicit key", () => {
    expect(
      resolveIdempotencyKey({
        eventType: EventTypes.FEEDBACK_SUBMITTED,
        entityId: "fb-1",
        idempotencyKey: "custom:key",
      }),
    ).toBe("custom:key");
  });
});

describe("event-system — dead letter critical events", () => {
  it("T4: critical events include feedback and order_available", () => {
    expect(CRITICAL_EVENTS).toContain(EventTypes.FEEDBACK_SUBMITTED);
    expect(CRITICAL_EVENTS).toContain(EventTypes.ORDER_AVAILABLE);
    expect(DOC16_CRITICAL_EVENTS).toContain(EventTypes.TASK_GENERATION_REQUESTED);
    expect(DOC16_CRITICAL_EVENTS).toContain(EventTypes.SIGNAL_RECALCULATION_REQUESTED);
  });
});

describe("event-system — module surface", () => {
  it("exports WorkerDispatcher and DeadLetterHandler facades", async () => {
    const dispatcher = await import("../../../workers/WorkerDispatcher.js");
    const dlq = await import("../../../workers/DeadLetterHandler.js");
    expect(typeof dispatcher.handleWorkerFailure).toBe("function");
    expect(typeof dlq.moveEventToDeadLetter).toBe("function");
    expect(typeof dlq.replayDeadLetteredEvent).toBe("function");
  });

  it("exports typed EventEmitter", async () => {
    const events = await import("../../../lib/events/index.js");
    expect(typeof events.emitEvent).toBe("function");
    expect(typeof events.resolveIdempotencyKey).toBe("function");
  });
});
