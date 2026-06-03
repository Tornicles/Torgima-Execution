/**
 * DOC 37 — version mismatch, stale projection, duplicate active task guards.
 */
import { describe, it, expect } from "vitest";
import { TorgimaError, torgimaErrorToStatus } from "../../../lib/errors.js";
import { canOverride } from "../../../lib/sourceOfTruth.js";
import {
  integrationEnabled,
  createTestUser,
  createTestBlueprint,
  createTestOrder,
  cleanupTestUser,
} from "../../helpers/db.js";
import { processFeedback } from "../../../engines/feedback/FeedbackProcessingEngine.js";
import { db, feedback, orders } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { guaranteeTask } from "../../../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";

describe("DOC 37 — errors.state-integrity", () => {
  it("STALE_STATE maps to 409 and is retryable", () => {
    expect(torgimaErrorToStatus("STALE_STATE")).toBe(409);
    expect(new TorgimaError("STALE_STATE", "State changed", true).retryable).toBe(true);
  });

  it("cached projection cannot override execution signals", () => {
    expect(canOverride("cached_projection", "execution_signals")).toBe(false);
    expect(canOverride("execution_signals", "cached_projection")).toBe(true);
  });

  it("StateMutationService exposes REJECTED_STALE result", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../../services/StateMutationService.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toContain("REJECTED_STALE");
    expect(src).toContain('"STALE_STATE"');
  });
});

describe.skipIf(!integrationEnabled())("DOC 37 — state integrity integration", () => {
  it("duplicate idempotencyKey returns same feedback id", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id);
    const order = await createTestOrder(bp.id, user.id, { status: "active", started_at: new Date() });
    const key = `doc37-dup-${Date.now()}`;

    const a = await processFeedback({
      orderId: order.id,
      userId: user.id,
      blueprintId: bp.id,
      completionStatus: "completed",
      score: 7,
      reflection: "First tab submission with enough detail for validity.",
      idempotencyKey: key,
    });
    const b = await processFeedback({
      orderId: order.id,
      userId: user.id,
      blueprintId: bp.id,
      completionStatus: "completed",
      score: 7,
      reflection: "Second tab duplicate should not double-insert.",
      idempotencyKey: key,
    }).catch((e) => e);

    if (!(b instanceof Error)) {
      expect(b.feedbackId).toBe(a.feedbackId);
    }

    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(feedback)
      .where(eq(feedback.order_id, order.id));
    expect(c).toBeLessThanOrEqual(1);

    await cleanupTestUser(user.id);
  }, 30_000);

  it("empty queue after feedback gets recovery task (loop continues)", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id);
    await db
      .update(orders)
      .set({ status: "completed" })
      .where(and(eq(orders.blueprint_id, bp.id), inArray(orders.status, ["pending", "active"])));

    const gu = await guaranteeTask({ blueprintId: bp.id, userId: user.id });
    expect(gu.orderId).toBeTruthy();

    await cleanupTestUser(user.id);
  }, 30_000);
});
