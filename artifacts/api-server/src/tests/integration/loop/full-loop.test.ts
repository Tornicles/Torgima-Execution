import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db, orders, feedback, signalSnapshots } from "@workspace/db";
import {
  integrationEnabled,
  createTestUser,
  createTestBlueprint,
  createInitialState,
  createTestOrder,
  cleanupTestUser,
} from "../../helpers/db.js";
import { calculate } from "../../../engines/signal/SignalCalculationEngine.js";
import { generate } from "../../../engines/task-generation/TaskGenerationEngine.js";
import { guaranteeTask } from "../../../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";

const run = integrationEnabled();

describe.skipIf(!run)("Full execution loop — integration (Prompt 16)", () => {
  let userId: string | undefined;
  let blueprintId: string | undefined;
  let orderId: string | undefined;

  beforeAll(async () => {
    const user = await createTestUser();
    userId = user.id;
    const blueprint = await createTestBlueprint(userId);
    blueprintId = blueprint.id;
    await createInitialState(blueprint.id, userId);
    const order = await createTestOrder(blueprint.id, userId);
    orderId = order.id;
  });

  afterAll(async () => {
    if (userId) await cleanupTestUser(userId);
  });

  it("blueprint bootstrap records exist", async () => {
    const [snap] = await db
      .select()
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId!), eq(signalSnapshots.is_current, true)))
      .limit(1);
    expect(snap?.is_current).toBe(true);
    const [ord] = await db.select().from(orders).where(eq(orders.id, orderId!)).limit(1);
    expect(ord?.blueprint_id).toBe(blueprintId);
  });

  it("order carries required textual fields", async () => {
    const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId!)).limit(1);
    expect(orderRow?.title).toBeTruthy();
    expect(orderRow?.instruction).toBeTruthy();
    expect(orderRow?.expected_output).toBeTruthy();
    expect(orderRow?.definition_of_done).toBeTruthy();
    expect(orderRow?.why_it_matters).toBeTruthy();
    expect((orderRow?.time_estimate_minutes ?? 0) > 0).toBe(true);
  });

  it("feedback row persists for completed work", async () => {
    await db.update(orders).set({ status: "active", started_at: new Date() }).where(eq(orders.id, orderId!));
    const rows = await db
      .insert(feedback)
      .values({
        order_id: orderId!,
        blueprint_id: blueprintId!,
        user_id: userId!,
        completion_status: "completed",
        score: 7,
        weighted_score: 7.0,
        blocker_json: {},
        reflection:
          "I completed this task and produced the required output. The deliverable meets the checklist and is usable.",
        validity: "valid",
      })
      .returning();
    expect(rows[0]?.completion_status).toBe("completed");
  });

  it("signal.calculate keeps a single active snapshot per blueprint", async () => {
    const result = await calculate({ blueprintId: blueprintId!, userId: userId! });
    expect(result.snapshotId).toBeTruthy();
    expect(result.metrics.tasks_in_window).toBeGreaterThan(0);
    const [{ activeSnapshots } = { activeSnapshots: 0 }] = await db
      .select({ activeSnapshots: sql<number>`count(*)::int` })
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId!), eq(signalSnapshots.is_current, true)));
    expect(activeSnapshots ?? 0).toBe(1);
  });

  it("task generation may add orders when capacity allows", async () => {
    const result = await generate({
      blueprintId: blueprintId!,
      userId: userId!,
      generationMode: "post_feedback",
      generationTrigger: "feedback_submitted",
    });
    expect(Array.isArray(result.order_ids)).toBe(true);
    if (result.orders_generated === 0) return;
    const nid = result.order_ids[0]!;
    const [o] = await db.select().from(orders).where(eq(orders.id, nid)).limit(1);
    expect(o?.expected_output).toBeTruthy();
  });

  it("guarantee engine settles when backlog exists", async () => {
    const outcome = await guaranteeTask({ blueprintId: blueprintId!, userId: userId! });
    expect(["SATISFIED", "PUBLISH_PRIMARY", "PIVOT_REVIEW"]).toContain(outcome.state);
  });
});
