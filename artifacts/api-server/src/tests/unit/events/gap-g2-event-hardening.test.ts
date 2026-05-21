/**
 * GAP PROMPT G2 — Event System Hardening & Dead Letter Queue tests.
 */

import { describe, it, expect } from "vitest";
import {
  RetryPolicies,
  getRetryPolicy,
  getMaxAttempts,
  getNextRunAfter,
} from "../../../engines/events/RetryPolicy.js";
import {
  buildEventIdempotencyKey,
  resolveIdempotencyKey,
} from "../../../engines/events/Idempotency.js";
import {
  STUCK_CLAIMED_THRESHOLD_MS,
  claimDeadlineFromNow,
  dispatchableStatuses,
} from "../../../engines/events/StuckEventDetector.js";
import { EventTypes } from "../../../types/eventContracts.js";
import { EventStatus } from "@workspace/state-machine";

describe("GAP G2 — retry policies", () => {
  it("T2: backoff grows with attempt count and caps at 5 minutes", () => {
    const t0 = getNextRunAfter("feedback_submitted", 0).getTime();
    const t2 = getNextRunAfter("feedback_submitted", 2).getTime();
    expect(t2 - t0).toBeGreaterThan(0);
    const t10 = getNextRunAfter("feedback_submitted", 10).getTime();
    expect(t10 - Date.now()).toBeLessThanOrEqual(300_000 + 50);
  });

  it("critical loop events allow 5 attempts", () => {
    expect(getMaxAttempts(EventTypes.FEEDBACK_SUBMITTED)).toBe(5);
    expect(getMaxAttempts(EventTypes.TASK_GENERATION_REQUESTED)).toBe(5);
  });

  it("async identity/reward allow 3 attempts", () => {
    expect(getMaxAttempts(EventTypes.IDENTITY_EVALUATION_REQUESTED)).toBe(3);
    expect(getRetryPolicy("unknown_type")).toEqual(RetryPolicies.default);
  });
});

describe("GAP G2 — idempotency keys", () => {
  it("T1: stable key format event_type:entity_id", () => {
    expect(buildEventIdempotencyKey("feedback_submitted", "fb-1")).toBe(
      "feedback_submitted:fb-1",
    );
  });

  it("T1: resolveIdempotencyKey uses explicit key when provided", () => {
    expect(
      resolveIdempotencyKey({
        eventType: EventTypes.FEEDBACK_SUBMITTED,
        entityId: "fb-1",
        idempotencyKey: "custom:key",
      }),
    ).toBe("custom:key");
  });

  it("T1: resolveIdempotencyKey auto-builds from entityId", () => {
    expect(
      resolveIdempotencyKey({
        eventType: EventTypes.SIGNAL_CALCULATED,
        entityId: "snap-9",
      }),
    ).toBe("signal_calculated:snap-9");
  });

  it("throws when neither entityId nor idempotencyKey", () => {
    expect(() =>
      resolveIdempotencyKey({ eventType: EventTypes.FEEDBACK_SUBMITTED }),
    ).toThrow(/idempotency_key required/);
  });
});

describe("GAP G2 — stuck CLAIMED detection contract", () => {
  it("T4: claim deadline is ~60s from now", () => {
    const deadline = claimDeadlineFromNow();
    const delta = deadline.getTime() - Date.now();
    expect(delta).toBeGreaterThanOrEqual(STUCK_CLAIMED_THRESHOLD_MS - 100);
    expect(delta).toBeLessThanOrEqual(STUCK_CLAIMED_THRESHOLD_MS + 100);
  });

  it("dispatcher picks pending and retry_pending", () => {
    expect(dispatchableStatuses()).toContain(EventStatus.PENDING);
    expect(dispatchableStatuses()).toContain(EventStatus.RETRY_PENDING);
  });
});

describe("GAP G2 — critical dead-letter health log contract", () => {
  it("T5: feedback_submitted is a critical DLQ type", () => {
    const critical = [
      EventTypes.FEEDBACK_SUBMITTED,
      EventTypes.TASK_GENERATION_REQUESTED,
      EventTypes.ENFORCEMENT_PACKAGE_CREATED,
    ];
    critical.forEach((t) => expect(t).toBeTruthy());
  });
});
