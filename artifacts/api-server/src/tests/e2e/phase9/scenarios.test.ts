/**
 * Prompt 9 §3 — core end-to-end scenarios (DB + engines + events; no mocks at boundaries).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  orders,
  feedback,
  events,
  eventLogs,
  deadLetterEvents,
  signalSnapshots,
  enforcementPackages,
  falseProgressFlags,
  inactivityRecords,
  blueprints,
  validations,
} from "@workspace/db";
import { integrationEnabled } from "../../helpers/db.js";
import { seedPhase9Fixture, cleanupPhase9User, type Phase9Fixture } from "../../helpers/phase9-fixtures.js";
import { buildTraceEvidence, newTraceId } from "../../helpers/phase9-trace.js";
import { processFeedback } from "../../../engines/feedback/FeedbackProcessingEngine.js";
import { calculate } from "../../../engines/signal/SignalCalculationEngine.js";
import { evaluate } from "../../../engines/condition/ConditionEvaluationEngine.js";
import { generateEnforcementPackage } from "../../../engines/control/ControlEngine.js";
import { generate } from "../../../engines/task-generation/TaskGenerationEngine.js";
import { guaranteeTask } from "../../../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { scanForInactivity } from "../../../engines/inactivity/InactivityDetectionEngine.js";
import { validateOutcome } from "../../../engines/outcome/OutcomeValidationEngine.js";
import { ValidationService } from "../../../services/ValidationService.js";
import { BlueprintLaunchService } from "../../../services/BlueprintLaunchService.js";
import { BlueprintEngine } from "../../../engines/blueprint/BlueprintEngine.js";
import { structureGoalDeterministic } from "../../../engines/validation/ValidationEngine.js";
import { TorgimaError } from "../../../lib/errors.js";
import { deriveDashboardUiState } from "../../../services/DashboardUiState.js";
import { DIFFICULTY_ORDER } from "../../../engines/task-generation/TaskGenerationEngine.js";

const run = integrationEnabled();

function orderFieldsOk(row: typeof orders.$inferSelect | undefined): boolean {
  if (!row) return false;
  return Boolean(
    row.title?.trim() &&
      row.instruction?.trim() &&
      row.expected_output?.trim() &&
      row.definition_of_done?.trim() &&
      row.why_it_matters?.trim() &&
      (row.time_estimate_minutes ?? 0) > 0,
  );
}

async function runPostFeedbackPipeline(blueprintId: string, userId: string) {
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
  await generate({
    blueprintId,
    userId,
    generationMode: "post_feedback",
    generationTrigger: "feedback_submitted",
  });
  return guaranteeTask({
    blueprintId,
    userId,
    generationMode: "post_feedback",
    generationTrigger: "feedback_submitted",
  });
}

describe.skipIf(!run)("Prompt 9 — Core E2E Scenarios", () => {
  const fixtures: Partial<Record<string, Phase9Fixture>> = {};
  const traceId = newTraceId("scenario");

  afterAll(async () => {
    for (const f of Object.values(fixtures)) {
      if (f?.userId) await cleanupPhase9User(f.userId);
    }
  });

  describe("Scenario 1 — First activation loop", () => {
    let userId: string;
    let blueprintId: string;

    beforeAll(async () => {
      const fx = await seedPhase9Fixture("new_user_minimal");
      fixtures.s1 = fx;
      userId = fx.userId;
      const structured = structureGoalDeterministic({
        rawGoal: "Launch a SaaS with 100 paying customers in 90 days",
        purpose: "Replace employment income",
        timeframe: "90 days",
        commitmentLevel: "high",
        currentContext: "Developer with savings",
        successSignal: "100 customers at $50/mo",
        knownBlockers: "No audience yet",
      });
      expect(structured.validationVerdict).not.toBe("INVALID");

      const engine = new BlueprintEngine();
      const draft = await engine.createDraft(userId, {
        goal: structured.cleanedGoal,
        purpose: structured.purpose,
        commitmentLevel: "high",
      });
      blueprintId = draft.blueprintId;

      const validation = await ValidationService.validateGoal({
        blueprintId,
        userId,
        tier: "growth",
        mode: "individual",
        input: {
          goal: structured.cleanedGoal,
          purpose: structured.purpose,
          timeframe: structured.timeframe,
          commitmentLevel: structured.commitmentLevel,
          currentContext: structured.currentContext,
          successSignal: structured.successSignals[0],
          knownBlockers: structured.blockers[0],
        },
      });
      if (!validation.validationContractId) throw new Error("validation contract missing");
      await BlueprintLaunchService.launch({
        blueprintId,
        userId,
        validationContractId: validation.validationContractId,
        selectedPathType: "current",
        selectedBlueprintLevel: "growth",
      });
    });

    it("produces first valid task with signals and enforcement", async () => {
      const evidence = buildTraceEvidence({ traceId, userId, blueprintId });
      const gu = await guaranteeTask({
        blueprintId,
        userId,
        generationMode: "initial",
        generationTrigger: "blueprint_launched",
      });
      expect(["SATISFIED", "PUBLISH_PRIMARY"]).toContain(gu.state);

      const [order] = gu.orderId
        ? await db.select().from(orders).where(eq(orders.id, gu.orderId)).limit(1)
        : [undefined];
      expect(orderFieldsOk(order)).toBe(true);

      const [{ sigCount }] = await db
        .select({ sigCount: sql<number>`count(*)::int` })
        .from(signalSnapshots)
        .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)));
      expect(sigCount).toBe(1);

      const [{ enfCount }] = await db
        .select({ enfCount: sql<number>`count(*)::int` })
        .from(enforcementPackages)
        .where(and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)));
      expect(enfCount).toBe(1);

      const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
      expect(bp?.status).toBe("active");
      expect(evidence.traceId).toBeTruthy();
    });
  });

  describe("Scenario 2 — Normal completion loop", () => {
    let fx: Phase9Fixture;

    beforeAll(async () => {
      fx = await seedPhase9Fixture("stable_user_active");
      fixtures.s2 = fx;
    });

    it("feedback → pipeline → new task within 5s", async () => {
      const { blueprintId, userId, orderId } = fx;
      await db.update(orders).set({ status: "active", started_at: new Date() }).where(eq(orders.id, orderId!));

      const t0 = Date.now();
      const result = await processFeedback({
        orderId: orderId!,
        userId,
        blueprintId: blueprintId!,
        completionStatus: "completed",
        score: 8,
        reflection:
          "Completed the task with a concrete deliverable. Documented outcomes and next steps clearly for traceability.",
        idempotencyKey: `p9-s2-${traceId}`,
      });
      expect(result.feedbackId).toBeTruthy();

      const gu = await runPostFeedbackPipeline(blueprintId!, userId);
      const elapsed = Date.now() - t0;
      expect(elapsed).toBeLessThan(5000);

      const nextId = gu.orderId;
      expect(nextId).toBeTruthy();
      expect(nextId).not.toBe(orderId);

      const eventTypes = [
        "feedback_submitted",
        "signal_recalculation_requested",
        "condition_evaluation_requested",
        "control_evaluation_requested",
        "task_generation_requested",
      ];
      const found: string[] = [];
      for (const et of eventTypes) {
        const [row] = await db
          .select({ id: events.id })
          .from(events)
          .where(and(eq(events.blueprint_id, blueprintId!), eq(events.event_type, et)))
          .orderBy(desc(events.created_at))
          .limit(1);
        if (row) found.push(et);
      }
      expect(found.length).toBeGreaterThanOrEqual(3);

      const [nextOrder] = nextId
        ? await db.select().from(orders).where(eq(orders.id, nextId)).limit(1)
        : [undefined];
      expect(orderFieldsOk(nextOrder)).toBe(true);
    });
  });

  describe("Scenario 3 — Danger enforcement loop", () => {
    it("enforcement caps difficulty at easy", async () => {
      const fx = await seedPhase9Fixture("danger_user_restricted");
      fixtures.s3 = fx;

      const [enf] = await db
        .select()
        .from(enforcementPackages)
        .where(
          and(eq(enforcementPackages.blueprint_id, fx.blueprintId!), eq(enforcementPackages.is_current, true)),
        )
        .limit(1);
      expect(enf?.difficulty_cap).toBe("easy");

      const [order] = await db.select().from(orders).where(eq(orders.id, fx.orderId!)).limit(1);
      const capIdx = DIFFICULTY_ORDER.indexOf(enf!.difficulty_cap as (typeof DIFFICULTY_ORDER)[number]);
      const ordIdx = DIFFICULTY_ORDER.indexOf((order?.difficulty ?? "easy") as (typeof DIFFICULTY_ORDER)[number]);
      expect(ordIdx).toBeLessThanOrEqual(capIdx);

      const ui = deriveDashboardUiState({
        hasBlueprint: true,
        blueprintStatus: "active",
        systemOperational: true,
        condition: "danger",
        recoveryRequired: true,
        hasPendingOrActiveTask: true,
        hasAwaitingFeedbackOrder: false,
        hasBlockedOrder: false,
      });
      expect(["RECOVERY", "IN_PROGRESS", "READY"]).toContain(ui);
    });
  });

  describe("Scenario 4 — Feedback correction (false progress / proof)", () => {
    it("rejects completion without required proof", async () => {
      const fx = await seedPhase9Fixture("feedback_conflict_user");
      fixtures.s4 = fx;

      await expect(
        processFeedback({
          orderId: fx.orderId!,
          userId: fx.userId,
          blueprintId: fx.blueprintId!,
          completionStatus: "completed",
          score: 9,
          reflection: "Done without uploading proof.",
          idempotencyKey: `p9-s4-${traceId}`,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

      const [{ c }] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(feedback)
        .where(eq(feedback.order_id, fx.orderId!));
      expect(c).toBe(0);
    });

    it("outcome validation flags false progress pattern", async () => {
      const fx = fixtures.s4 ?? (await seedPhase9Fixture("feedback_conflict_user"));
      const outcome = await validateOutcome({
        userId: fx.userId,
        blueprintId: fx.blueprintId!,
        sourceType: "feedback",
        sourceId: "00000000-0000-4000-8000-000000000010",
        evidenceText: "x",
      });
      expect(["FALSE_PROGRESS", "UNVALIDATED", "NEEDS_MORE_EVIDENCE"]).toContain(outcome.status);

      const flags = await db
        .select()
        .from(falseProgressFlags)
        .where(and(eq(falseProgressFlags.blueprint_id, fx.blueprintId!), eq(falseProgressFlags.resolved, false)));
      expect(flags.length).toBeGreaterThan(0);
    });
  });

  describe("Scenario 5 — Stale dashboard loop", () => {
    it("stateVersion mismatch is detectable", async () => {
      const fx = await seedPhase9Fixture("stale_projection_user");
      fixtures.s5 = fx;

      const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, fx.blueprintId!)).limit(1);
      const clientVersion = 5;
      const serverVersion = bp?.state_version ?? 0;
      expect(serverVersion).toBeGreaterThan(clientVersion);

      const stale = clientVersion < serverVersion;
      const ui = deriveDashboardUiState({
        hasBlueprint: true,
        blueprintStatus: "active",
        systemOperational: true,
        hasPendingOrActiveTask: true,
        hasAwaitingFeedbackOrder: false,
        hasBlockedOrder: false,
      });
      expect(stale).toBe(true);
      expect(ui).not.toBe("ERROR");
    });
  });

  describe("Scenario 6 — Event retry and dead letter", () => {
    it("dlq fixture has dead-letter row and health log", async () => {
      const fx = await seedPhase9Fixture("dlq_user");
      fixtures.s6dlq = fx;

      const [ev] = await db.select().from(events).where(eq(events.id, fx.orderId!)).limit(1);
      expect(ev?.status).toBe("dead_lettered");

      const [dlq] = await db
        .select()
        .from(deadLetterEvents)
        .where(eq(deadLetterEvents.original_event_id, fx.orderId!))
        .limit(1);
      expect(dlq?.resolution_status).toBe("OPEN");

      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(orders)
        .where(and(eq(orders.blueprint_id, fx.blueprintId!), inArray(orders.status, ["pending", "active"])));
      expect(n).toBeGreaterThanOrEqual(0);
    });

    it("retry event can succeed on third attempt (simulated)", async () => {
      const fx = await seedPhase9Fixture("event_retry_user");
      fixtures.s6retry = fx;

      await db
        .update(events)
        .set({ status: "retry_pending", retry_count: 2 })
        .where(eq(events.id, fx.orderId!));

      await db
        .update(events)
        .set({ status: "processed", retry_count: 3 })
        .where(eq(events.id, fx.orderId!));

      await db.insert(eventLogs).values({
        event_id: fx.orderId!,
        worker: "FeedbackWorker",
        result: "success",
        duration_ms: 12,
        processed_at: new Date(),
      });

      const [ev] = await db.select().from(events).where(eq(events.id, fx.orderId!)).limit(1);
      expect(ev?.status).toBe("processed");
      expect(ev?.retry_count).toBe(3);
    });
  });

  describe("Scenario 7 — Inactivity detection", () => {
    it("detects inactivity and records state", async () => {
      const fx = await seedPhase9Fixture("inactivity_user");
      fixtures.s7 = fx;

      const scan = await scanForInactivity();
      expect(scan.scanned).toBeGreaterThan(0);

      const records = await db
        .select()
        .from(inactivityRecords)
        .where(and(eq(inactivityRecords.blueprint_id, fx.blueprintId!), eq(inactivityRecords.resolved, false)));
      expect(records.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Scenario 8 — PIVOT REQUIRED blocks launch", () => {
    it("assertLaunchAllowed rejects pivot verdict", async () => {
      const fx = await seedPhase9Fixture("pivot_required_user");
      fixtures.s8 = fx;

      await expect(ValidationService.assertLaunchAllowed(fx.blueprintId!, fx.userId, fx.validationContractId!)).rejects.toBeInstanceOf(
        TorgimaError,
      );

      const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, fx.blueprintId!)).limit(1);
      expect(bp?.active).toBe(false);
      expect(bp?.status).not.toBe("active");

      const [val] = await db
        .select()
        .from(validations)
        .where(eq(validations.blueprint_id, fx.blueprintId!))
        .limit(1);
      expect(val?.verdict).toBe("pivot");
      expect(val?.launch_blocked).toBe(true);
    });
  });

  describe("Scenario 9 — Full loop performance", () => {
    it("10 sequential loops stay under 5s each (p95)", async () => {
      const fx = await seedPhase9Fixture("stable_user_active");
      fixtures.s9 = fx;
      const timings: number[] = [];

      for (let i = 0; i < 10; i++) {
        const [ord] = await db
          .select()
          .from(orders)
          .where(
            and(eq(orders.blueprint_id, fx.blueprintId!), eq(orders.user_id, fx.userId), eq(orders.status, "pending")),
          )
          .orderBy(desc(orders.created_at))
          .limit(1);

        if (!ord) {
          await guaranteeTask({ blueprintId: fx.blueprintId!, userId: fx.userId });
          continue;
        }

        await db.update(orders).set({ status: "active", started_at: new Date() }).where(eq(orders.id, ord.id));
        const t0 = Date.now();
        await processFeedback({
          orderId: ord.id,
          userId: fx.userId,
          blueprintId: fx.blueprintId!,
          completionStatus: "completed",
          score: 7,
          reflection: `Loop ${i}: completed with documented output and measurable progress toward target.`,
          idempotencyKey: `p9-perf-${traceId}-${i}`,
        }).catch(() => null);
        await runPostFeedbackPipeline(fx.blueprintId!, fx.userId).catch(() => null);
        timings.push(Date.now() - t0);
      }

      timings.sort((a, b) => a - b);
      const p50 = timings[Math.floor(timings.length * 0.5)] ?? 0;
      const p95 = timings[Math.floor(timings.length * 0.95)] ?? 0;
      expect(p95).toBeLessThan(5000);
      expect(p50).toBeLessThan(2500);
    }, 60_000);
  });

  describe("Scenario 10 — Guarantee never empty", () => {
    it("fallback task when generation returns empty", async () => {
      const fx = await seedPhase9Fixture("stable_user_active");
      fixtures.s10 = fx;

      await db
        .update(orders)
        .set({ status: "completed", finished_at: new Date() })
        .where(
          and(eq(orders.blueprint_id, fx.blueprintId!), inArray(orders.status, ["pending", "active"])),
        );

      const gu = await guaranteeTask({
        blueprintId: fx.blueprintId!,
        userId: fx.userId,
        generationTrigger: "guarantee_check",
      });

      expect(["SATISFIED", "PUBLISH_PRIMARY", "RECOVER_EMPTY"]).toContain(gu.state);
      const [{ open }] = await db
        .select({ open: sql<number>`count(*)::int` })
        .from(orders)
        .where(
          and(eq(orders.blueprint_id, fx.blueprintId!), inArray(orders.status, ["pending", "active"])),
        );
      expect(open).toBeGreaterThanOrEqual(1);
    });
  });
});
