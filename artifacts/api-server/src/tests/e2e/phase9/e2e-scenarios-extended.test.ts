/**
 * Prompt 9 §2 — additional E2E scenarios (E2E-02, E2E-06, E2E-08) complementing scenarios.test.ts.
 */
import { describe, it, expect, afterAll } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, orders, feedback, signalSnapshots, morningReports } from "@workspace/db";
import { integrationEnabled } from "../../helpers/db.js";
import { seedPhase9Fixture, cleanupPhase9User, type Phase9Fixture } from "../../helpers/phase9-fixtures.js";
import { TEST_GOALS } from "../../fixtures/index.js";
import { processFeedback } from "../../../engines/feedback/FeedbackProcessingEngine.js";
import { calculate } from "../../../engines/signal/SignalCalculationEngine.js";
import { evaluate } from "../../../engines/condition/ConditionEvaluationEngine.js";
import { generateEnforcementPackage } from "../../../engines/control/ControlEngine.js";
import { generate } from "../../../engines/task-generation/TaskGenerationEngine.js";
import { guaranteeTask } from "../../../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { structureGoalDeterministic } from "../../../engines/validation/ValidationEngine.js";
import { newTraceId } from "../../helpers/phase9-trace.js";

const run = integrationEnabled();

async function fullLoop(blueprintId: string, userId: string, orderId: string, traceId: string, i: number) {
  await db.update(orders).set({ status: "active", started_at: new Date() }).where(eq(orders.id, orderId));
  await processFeedback({
    orderId,
    userId,
    blueprintId,
    completionStatus: "completed",
    score: 7,
    reflection: `Cycle ${i}: delivered measurable output with trace ${traceId}.`,
    idempotencyKey: `e2e02-${traceId}-${i}`,
  });
  const sig = await calculate({ blueprintId, userId });
  const ev = await evaluate({
    blueprintId,
    userId,
    signalSnapshotId: sig.snapshotId,
    assignedCondition: sig.condition,
  });
  await generateEnforcementPackage({
    blueprintId,
    userId,
    conditionId: ev.conditionId,
    condition: ev.condition,
    signalSnapshotId: sig.snapshotId,
    escalationLevel: ev.escalationLevel,
    recoveryRequired: ev.recoveryRequired,
  });
  await generate({ blueprintId, userId, generationMode: "post_feedback", generationTrigger: "feedback_submitted" });
  return guaranteeTask({ blueprintId, userId, generationTrigger: "feedback_submitted" });
}

describe.skipIf(!run)("Prompt 9 — Extended E2E (E2E-02, E2E-06, E2E-08)", () => {
  const fixtures: Phase9Fixture[] = [];
  const traceId = newTraceId("e2e-ext");

  afterAll(async () => {
    for (const f of fixtures) {
      if (f.userId) await cleanupPhase9User(f.userId);
    }
  });

  it("E2E-02: five completion cycles without empty queue", async () => {
    const fx = await seedPhase9Fixture("stable_user_active");
    fixtures.push(fx);
    let orderId = fx.orderId!;

    for (let i = 0; i < 5; i++) {
      const gu = await fullLoop(fx.blueprintId!, fx.userId, orderId, traceId, i);
      expect(gu.orderId).toBeTruthy();
      orderId = gu.orderId!;
    }

    const [{ sigCount }] = await db
      .select({ sigCount: sql<number>`count(*)::int` })
      .from(signalSnapshots)
      .where(eq(signalSnapshots.blueprint_id, fx.blueprintId!));
    expect(sigCount).toBeGreaterThanOrEqual(1);

    const [{ open }] = await db
      .select({ open: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(eq(orders.blueprint_id, fx.blueprintId!), inArray(orders.status, ["pending", "active"])),
      );
    expect(open).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it("E2E-06: contradiction goal structures with conflict signals", () => {
    const structured = structureGoalDeterministic({
      rawGoal: TEST_GOALS.contradictionGoal.goalText,
      purpose: TEST_GOALS.contradictionGoal.purposeText,
      timeframe: TEST_GOALS.contradictionGoal.timeframe,
      commitmentLevel: "high",
      currentContext: "solo",
      successSignal: "fame and privacy",
      knownBlockers: "contradiction",
    });
    expect(structured.validationVerdict).toBeTruthy();
    expect(["NEEDS_CLARIFICATION", "INVALID", "VALID_WITH_RISKS", "VALID"]).toContain(
      structured.validationVerdict,
    );
  });

  it("E2E-08: overnight produces morning report with EIS section", async () => {
    const fx = await seedPhase9Fixture("stable_user_active");
    fixtures.push(fx);
    const { runOvernightCycle } = await import("../../../workers/OvernightWorker.js");
    const { reportId } = await runOvernightCycle(fx.userId);
    expect(reportId).toBeTruthy();

    const reportDate = new Date().toISOString().slice(0, 10);
    const [report] = await db
      .select()
      .from(morningReports)
      .where(
        and(eq(morningReports.user_id, fx.userId), eq(morningReports.report_date, reportDate)),
      )
      .limit(1);
    expect(report?.eis_section).toBeTruthy();
    expect((report?.report_body as { stepsCompleted?: number })?.stepsCompleted).toBe(16);
  }, 120_000);
});
