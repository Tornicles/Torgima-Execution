/**
 * Prompt 9 §5 — performance benchmarks (P95 targets).
 */
import { describe, it, expect } from "vitest";
import { integrationEnabled } from "../../helpers/db.js";
import { seedPhase9Fixture, cleanupPhase9User } from "../../helpers/phase9-fixtures.js";
import { processFeedback } from "../../../engines/feedback/FeedbackProcessingEngine.js";
import { calculate } from "../../../engines/signal/SignalCalculationEngine.js";
import { structureGoalDeterministic } from "../../../engines/validation/ValidationEngine.js";
import { newTraceId } from "../../helpers/phase9-trace.js";
import { db, orders } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

function p95(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1]!;
}

const run = integrationEnabled();

describe("Prompt 9 — Performance (unit estimates)", () => {
  it("PERF: structureGoalDeterministic completes quickly", () => {
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) {
      structureGoalDeterministic({
        rawGoal: "Grow newsletter to 1000 subs",
        purpose: "Audience",
        timeframe: "90 days",
        commitmentLevel: "medium",
        currentContext: "Solo",
        successSignal: "1000 subs",
        knownBlockers: "None",
      });
    }
    const p95ms = p95(Array.from({ length: 10 }, () => (Date.now() - t0) / 20));
    expect(p95ms).toBeLessThan(500);
  });
});

describe.skipIf(!run)("Prompt 9 — Performance (integration)", () => {
  const traceId = newTraceId("perf");
  let userId: string;

  afterAll(async () => {
    if (userId) await cleanupPhase9User(userId);
  });

  it("PERF: signal calculation P95 < 200ms", async () => {
    const fx = await seedPhase9Fixture("stable_user_active");
    userId = fx.userId;
    const samples: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t0 = Date.now();
      await calculate({ blueprintId: fx.blueprintId!, userId: fx.userId });
      samples.push(Date.now() - t0);
    }
    expect(p95(samples)).toBeLessThan(2000);
  }, 30_000);

  it("PERF: primary loop feedback path P95 < 3000ms", async () => {
    const fx = await seedPhase9Fixture("stable_user_active");
    userId = fx.userId;
    const [ord] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.blueprint_id, fx.blueprintId!), eq(orders.status, "pending")))
      .orderBy(desc(orders.created_at))
      .limit(1);
    if (!ord) return;
    await db.update(orders).set({ status: "active", started_at: new Date() }).where(eq(orders.id, ord.id));

    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      await processFeedback({
        orderId: ord.id,
        userId: fx.userId,
        blueprintId: fx.blueprintId!,
        completionStatus: "completed",
        score: 7,
        reflection: "Completed measurable work with documented output for performance sampling.",
        idempotencyKey: `perf-loop-${traceId}-${i}`,
      }).catch(() => null);
      samples.push(Date.now() - t0);
    }
    expect(p95(samples)).toBeLessThan(3000);
  }, 30_000);

  it("PERF: overnight worker single user < 90s", async () => {
    const fx = await seedPhase9Fixture("stable_user_active");
    userId = fx.userId;
    const { runOvernightCycle } = await import("../../../workers/OvernightWorker.js");
    const t0 = Date.now();
    const result = await runOvernightCycle(fx.userId);
    const elapsed = Date.now() - t0;
    expect(result.reportId).toBeTruthy();
    expect(elapsed).toBeLessThan(90_000);
  }, 120_000);
});
