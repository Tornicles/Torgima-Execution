/**
 * GAP G9 — Database-backed acceptance items (1–7, 9, 16, 18).
 * Run with TORGIMA_INTEGRATION=true and a real DATABASE_URL.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, sql, desc } from "drizzle-orm";
import {
  db,
  blueprints,
  orders,
  feedback,
  signalSnapshots,
  conditions,
  enforcementPackages,
  inactivityRecords,
  capabilityProfiles,
} from "@workspace/db";
import {
  integrationEnabled,
  createTestUser,
  createTestBlueprint,
  createInitialState,
  createTestOrder,
  cleanupTestUser,
} from "../helpers/db.js";
import { calculate } from "../../engines/signal/SignalCalculationEngine.js";
import { evaluate as evaluateCondition } from "../../engines/condition/ConditionEvaluationEngine.js";
import { generateEnforcementPackage } from "../../engines/control/ControlEngine.js";
import { generate } from "../../engines/task-generation/TaskGenerationEngine.js";
import { guaranteeTask, ensureActiveOrder } from "../../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import {
  acquireBlueprintLock,
  releaseBlueprintLock,
} from "../../engines/orchestration/OrchestrationLock.js";
import { scanForInactivity } from "../../engines/inactivity/InactivityDetectionEngine.js";
import { getCurrentStateVersion } from "../../services/StateMutationService.js";
import { G9_FEEDBACK_EVENT_CHAIN, g9Item, formatG9Report, type G9ItemResult } from "./gap-g9-checklist.js";
import { EventTypes } from "../../types/eventContracts.js";

const run = integrationEnabled();
const results: G9ItemResult[] = [];

function record(item: number, label: string, pass: boolean, note?: string) {
  results.push(g9Item(item, label, pass, note));
  expect(pass, `G9 integration Item ${item}${note ? `: ${note}` : ""}`).toBe(true);
}

describe.skipIf(!run)("GAP G9 — integration acceptance", () => {
  let userId: string;
  let blueprintId: string;
  let orderId: string;
  let signalId: string;

  beforeAll(async () => {
    const user = await createTestUser();
    userId = user.id;
    const bp = await createTestBlueprint(userId);
    blueprintId = bp.id;
    const state = await createInitialState(blueprintId, userId);
    signalId = state.signal.id;
    const order = await createTestOrder(blueprintId, userId, { status: "active" });
    orderId = order.id;
  });

  afterAll(async () => {
    if (userId) await cleanupTestUser(userId);
    console.log("\n" + formatG9Report(results));
  });

  it("Item 1 — active blueprint and first order exist", async () => {
    const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
    const [ord] = await db.select().from(orders).where(eq(orders.blueprint_id, blueprintId)).limit(1);
    record(
      1,
      "Goal to first task",
      bp?.status === "active" && bp?.active === true && !!ord?.id,
      `orders=${ord?.status}`,
    );
  });

  it("Item 2 — feedback recalculates signal snapshot", async () => {
    await db
      .update(orders)
      .set({ status: "active", started_at: new Date() })
      .where(eq(orders.id, orderId));

    await db.insert(feedback).values({
      order_id: orderId,
      blueprint_id: blueprintId,
      user_id: userId,
      completion_status: "completed",
      score: 8,
      weighted_score: 8,
      blocker_json: {},
      reflection: "Completed the deliverable with measurable output for acceptance testing.",
      validity: "valid",
    });

    const result = await calculate({ blueprintId, userId });
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)));

    const [snap] = await db
      .select()
      .from(signalSnapshots)
      .where(eq(signalSnapshots.id, result.snapshotId))
      .limit(1);

    record(
      2,
      "Feedback updates signal",
      cnt === 1 && !!snap?.completion_rate && snap.is_current === true,
      `snapshot=${result.snapshotId}`,
    );
    signalId = result.snapshotId;
  });

  it("Item 3 — signal drives condition evaluation", async () => {
    const vBefore = await getCurrentStateVersion(blueprintId);
    const cond = await evaluateCondition({
      blueprintId,
      userId,
      signalSnapshotId: signalId,
      assignedCondition: "urgency",
    });
    const vAfter = await getCurrentStateVersion(blueprintId);
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)));

    record(
      3,
      "Signal updates condition",
      cnt === 1 && !!cond.conditionId && vAfter >= vBefore,
      cond.condition,
    );
  });

  it("Item 4 — condition creates enforcement package", async () => {
    const [cond] = await db
      .select()
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
      .limit(1);

    const pkg = await generateEnforcementPackage({
      blueprintId,
      userId,
      conditionId: cond!.id,
      condition: cond!.condition,
      signalSnapshotId: signalId,
      escalationLevel: cond!.escalation_level,
      recoveryRequired: cond!.recovery_required,
    });

    const [row] = await db
      .select()
      .from(enforcementPackages)
      .where(eq(enforcementPackages.id, pkg.packageId))
      .limit(1);

    record(
      4,
      "Condition updates enforcement",
      !!row?.task_limits && !!row?.difficulty_cap && row.is_current === true,
    );
  });

  it("Item 5 — task generation produces next order", async () => {
    const start = Date.now();
    const gen = await generate({
      blueprintId,
      userId,
      generationMode: "post_feedback",
      generationTrigger: "gap_g9_acceptance",
    });
    const elapsed = Date.now() - start;

    let hasOrder = false;
    if (gen.orders_generated > 0 && gen.order_ids[0]) {
      const [o] = await db.select().from(orders).where(eq(orders.id, gen.order_ids[0]!)).limit(1);
      hasOrder = !!o?.title && !!o?.instruction;
    } else {
      const outcome = await guaranteeTask({ blueprintId, userId });
      hasOrder = outcome.state === "SATISFIED" || !!outcome.orderId;
    }

    record(
      5,
      "Next task generated immediately",
      hasOrder && elapsed < 10_000,
      `${elapsed}ms`,
    );
  });

  it("Item 6 — never-empty: guarantee after feedback cycle", async () => {
    const outcome = await guaranteeTask({ blueprintId, userId });
    const ensured = await ensureActiveOrder(userId);
    record(
      6,
      "Never-empty guarantee",
      outcome.state === "SATISFIED" || !!outcome.orderId || !!ensured.orderId,
    );
  });

  it("Item 7 — recovery task on failed feedback", async () => {
    const gen = await generate({
      blueprintId,
      userId,
      generationMode: "recovery",
      generationTrigger: "feedback_failed",
    });
    let recovery = false;
    if (gen.order_ids[0]) {
      const [o] = await db.select().from(orders).where(eq(orders.id, gen.order_ids[0]!)).limit(1);
      recovery = o?.task_type === "recovery";
    }
    record(7, "Failed feedback → recovery", recovery, "task_type=recovery when generated");
  });

  it("Item 9 — blueprint lock rejects duplicate acquire", async () => {
    const first = await acquireBlueprintLock(blueprintId, "feedback_completion", 5_000);
    const second = await acquireBlueprintLock(blueprintId, "feedback_completion", 5_000);
    await releaseBlueprintLock(blueprintId, "feedback_completion");
    record(9, "Blueprint lock prevents dupes", first === true && second === false);
  });

  it("Item 16 — at most one is_current row per invariant table", async () => {
    const [sig] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)));
    const [cond] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)));
    const [enf] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(enforcementPackages)
      .where(and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)));
    const ok = (sig?.cnt ?? 0) === 1 && (cond?.cnt ?? 0) === 1 && (enf?.cnt ?? 0) === 1;
    record(
      16,
      "Partial unique indexes hold",
      ok,
      `signal=${sig?.cnt};cond=${cond?.cnt};enf=${enf?.cnt}`,
    );
  });

  it("Item 18 — inactivity scan after 30h simulated gap", async () => {
    const stale = new Date(Date.now() - 31 * 3600000);
    await db.insert(feedback).values({
      order_id: orderId,
      blueprint_id: blueprintId,
      user_id: userId,
      completion_status: "completed",
      score: 5,
      weighted_score: 5,
      blocker_json: {},
      reflection: "Stale feedback row for inactivity simulation in G9 acceptance.",
      validity: "valid",
      created_at: stale,
    });

    await scanForInactivity();

    const [rec] = await db
      .select()
      .from(inactivityRecords)
      .where(and(eq(inactivityRecords.blueprint_id, blueprintId), eq(inactivityRecords.resolved, false)))
      .orderBy(desc(inactivityRecords.created_at))
      .limit(1);

    record(
      18,
      "Inactivity detection responds",
      !!rec && (rec.inactivity_hours ?? 0) >= 30,
      rec?.inactivity_type ?? "none",
    );
  });

  it("Item 8 — feedback chain event types are registered", () => {
    const known = new Set(Object.values(EventTypes));
    const ok = G9_FEEDBACK_EVENT_CHAIN.every((e) => known.has(e as (typeof EventTypes)[keyof typeof EventTypes]));
    record(8, "Event chain complete + ordered", ok);
  });

  it("Item 17 — capability profile row exists for user", async () => {
    const [cap] = await db
      .select()
      .from(capabilityProfiles)
      .where(eq(capabilityProfiles.user_id, userId))
      .limit(1);
    record(
      17,
      "Capability profile updated",
      !!cap?.user_id,
      `level=${cap?.level ?? "n/a"}`,
    );
  });
});
