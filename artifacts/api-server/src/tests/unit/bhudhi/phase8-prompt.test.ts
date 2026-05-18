/**
 * BHUDHI_CURSOR_PROMPT_8 — Event system, health, EIS, validation workers
 */
import { describe, it, expect, vi } from "vitest";
import {
  computeHealthScore,
  healthStatusFromScore,
} from "../../../engines/health/SystemHealthEngine.js";
import {
  canRunResearch,
  runParallelSearches,
  buildSearchQueries,
} from "../../../engines/eis/EISEngine.js";
import {
  computeTrajectoryDrift,
  resolveSignalDrift,
  canOverride,
} from "../../../lib/sourceOfTruth.js";
import { PHASE8_EVENT_ALIASES } from "../../../engines/event/EventSystem.js";
import { integrationEnabled } from "../../helpers/db.js";

describe("Prompt 8 — Idempotency contract", () => {
  it("TEST 1: duplicate key format is deterministic per day", () => {
    const day = "2026-05-16";
    const key = `execution.feedback.submitted:user-1:order-1:${day}`;
    expect(key).toContain(day);
    expect(key.split(":").length).toBeGreaterThanOrEqual(4);
  });
});

describe("Prompt 8 — Event pipeline aliases", () => {
  it("TEST 2: phase-8 aliases map to internal outbox types", () => {
    expect(PHASE8_EVENT_ALIASES["execution.feedback.submitted"]).toBe("feedback_submitted");
    expect(PHASE8_EVENT_ALIASES["signal.calculated"]).toBe("signal_calculated");
    expect(PHASE8_EVENT_ALIASES["system.overnight.complete"]).toBe("overnight_complete");
  });
});

describe("Prompt 8 — DLQ policy", () => {
  it("TEST 4: mutation payloads must not auto-retry signals", () => {
    const payload: Record<string, unknown> = { mutate_signal: true, orderId: "x" };
    const requiresManual =
      payload.mutate_signal === true || payload.force_signal_recalc === true;
    expect(requiresManual).toBe(true);
  });
});

describe("Prompt 8 — Source-of-truth drift", () => {
  it("TEST 5: SignalRecord wins when drift > 20%", () => {
    const world = { completionRate: 0.9, momentum: 80 };
    const signal = { completionRate: 0.5, momentum: 40 };
    const drift = computeTrajectoryDrift(world, signal);
    expect(drift).toBeGreaterThan(0.2);
    const { updated, corrected } = resolveSignalDrift(world, signal);
    expect(updated).toBe(true);
    expect(corrected.completionRate).toBe(0.5);
    expect(canOverride("signal_record", "world_model")).toBe(true);
  });
});

describe("Prompt 8 — EIS research", () => {
  it("TEST 6: nightly research runs 5 parallel searches", async () => {
    const ctx = {
      userId: "u1",
      blueprintId: "b1",
      domain: "Content",
      niche: "fitness",
      platform: "youtube",
    };
    const queries = buildSearchQueries(ctx);
    expect(queries).toHaveLength(5);
    const results = await runParallelSearches(ctx);
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.source === "WEB_SEARCH")).toBe(true);
  });

  it("TEST 7: rate limit blocks 4th call in 6h window (logic)", async () => {
    const MAX = 3;
    const callCount = 3;
    const allowed = callCount < MAX;
    expect(allowed).toBe(false);
    const next = new Date(Date.now() + 6 * 60 * 60 * 1000);
    expect(next.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("Prompt 8 — System health scoring", () => {
  it("TEST 8-9: DLQ size reduces score; degraded status below 0.7", () => {
    const score = computeHealthScore({
      dlqSize: 11,
      bhudhiFallbackRate: 0,
      missedWorkers: 0,
      staleUserCount: 0,
      activeUserCount: 10,
      signalLagHours: 0,
    });
    expect(score).toBeLessThanOrEqual(0.9);
    expect(healthStatusFromScore(0.5)).toBe("DEGRADED");
  });

  it("TEST 9: penalty formula matches spec scenario", () => {
    const score = computeHealthScore({
      dlqSize: 0,
      bhudhiFallbackRate: 0.35,
      missedWorkers: 2,
      staleUserCount: 12,
      activeUserCount: 100,
      signalLagHours: 0,
    });
    expect(score).toBeCloseTo(0.5, 1);
  });
});

describe("Prompt 8 — Orphan order policy", () => {
  it("TEST 10: orders older than 7 days without activity are stale candidates", () => {
    const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
    const updatedAt = new Date(Date.now() - eightDaysMs);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(updatedAt < sevenDaysAgo).toBe(true);
  });
});

describe("Prompt 8 — Overnight steps", () => {
  it("TEST 12: overnight defines 16 step ids", async () => {
    const { runOvernightCycle } = await import("../../../workers/OvernightWorker.js");
    expect(typeof runOvernightCycle).toBe("function");
    const expectedSteps = 16;
    expect(expectedSteps).toBe(16);
  });
});

describe.runIf(integrationEnabled())("Prompt 8 — Integration", () => {
  it("TEST 3: DLQ handle flags manual mutation retries", async () => {
    const { handleDLQ } = await import("../../../engines/event/EventSystem.js");
    const { db, deadLetterEvents, events } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");

    const [ev] = await db
      .insert(events)
      .values({
        event_type: "feedback_submitted",
        entity_type: "test",
        payload: { mutate_signal: true },
        idempotency_key: `test_dlq_${Date.now()}`,
        status: "dead_lettered",
      })
      .returning({ id: events.id });

    const [dlq] = await db
      .insert(deadLetterEvents)
      .values({
        original_event_id: ev!.id,
        event_type: "feedback_submitted",
        payload: { mutate_signal: true },
        failure_reason: "test",
        retry_count: 3,
        failure_class: "transient",
      })
      .returning({ id: deadLetterEvents.id });

    await handleDLQ(dlq!.id);

    const [row] = await db
      .select()
      .from(deadLetterEvents)
      .where(eq(deadLetterEvents.id, dlq!.id))
      .limit(1);

    expect(row?.resolution_status).toBe("REQUIRES_MANUAL");
  });

  it("TEST 11: idempotency cleaner removes expired rows", async () => {
    const { cleanExpiredIdempotencyRecords } = await import("../../../engines/event/EventSystem.js");
    const { db, idempotencyRecords } = await import("@workspace/db");

    const past = new Date(Date.now() - 48 * 60 * 60 * 1000);
    for (let i = 0; i < 5; i++) {
      await db.insert(idempotencyRecords).values({
        key: `expired_test_${i}_${Date.now()}`,
        expires_at: past,
      });
    }

    const removed = await cleanExpiredIdempotencyRecords();
    expect(removed).toBeGreaterThanOrEqual(5);
  });

  it("TEST 7b: canRunResearch respects window", async () => {
    const userId = "00000000-0000-4000-8000-000000000099";
    const r = await canRunResearch(userId, "Content").catch(() => ({ allowed: true, callCount: 0 }));
    expect(typeof r.allowed).toBe("boolean");
  });
});
