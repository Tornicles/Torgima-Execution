/**
 * DOC 37 §1 — race condition tests.
 */
import { describe, it, expect } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  integrationEnabled,
  createTestUser,
  createTestBlueprint,
  createTestOrder,
  createInitialState,
  cleanupTestUser,
} from "../../helpers/db.js";
import { db, feedback, blueprints } from "@workspace/db";
import { mutate } from "../../../services/StateMutationService.js";
import {
  processFeedbackSubmission,
  type FeedbackSubmissionPayload,
} from "../../../engines/feedback/submitFeedbackPhase1.js";
import { TorgimaError } from "../../../lib/errors.js";

const run = integrationEnabled();

function feedbackPayload(
  orderId: string,
  stateVersion: number,
  idempotencyKey: string,
): FeedbackSubmissionPayload {
  return {
    orderId,
    completion: "COMPLETED",
    clientStateVersion: stateVersion,
    idempotencyKey,
    effortScore: 4,
    frictionScore: 2,
    durationMinutes: 45,
    userNotes: "Completed the task with enough reflection detail for validation.",
  };
}

describe("DOC 37 — errors.race-conditions (unit surface)", () => {
  it("concurrent blueprint mutation — second call gets STALE_STATE", async () => {
    if (!run) return;
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id, { state_version: 1 });

    const [r1, r2] = await Promise.allSettled([
      mutate({
        blueprintId: bp.id,
        userId: user.id,
        expectedVersion: 1,
        mutationName: "DOC37_RACE_A",
        mutationFn: async () => ({ ok: true }),
      }),
      mutate({
        blueprintId: bp.id,
        userId: user.id,
        expectedVersion: 1,
        mutationName: "DOC37_RACE_B",
        mutationFn: async () => ({ ok: true }),
      }),
    ]);

    const okCount = [r1, r2].filter((r) => r.status === "fulfilled").length;
    const staleCount = [r1, r2].filter(
      (r) => r.status === "rejected" && (r.reason as TorgimaError)?.code === "STALE_STATE",
    ).length;
    expect(okCount).toBe(1);
    expect(staleCount).toBe(1);

    await cleanupTestUser(user.id);
  }, 30_000);

  it("concurrent feedback submissions — only one succeeds per order", async () => {
    if (!run) return;
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id, { state_version: 1 });
    await createInitialState(bp.id, user.id);
    const order = await createTestOrder(bp.id, user.id, { status: "active", started_at: new Date() });
    const version = bp.state_version ?? 1;

    const results = await Promise.allSettled([
      processFeedbackSubmission(user.id, feedbackPayload(order.id, version, `doc37-race-a-${Date.now()}`)),
      processFeedbackSubmission(user.id, feedbackPayload(order.id, version, `doc37-race-b-${Date.now()}`)),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const stale = results.filter(
      (r) => r.status === "rejected" && (r.reason as TorgimaError)?.code === "STALE_STATE",
    );
    expect(successes.length + stale.length).toBe(2);
    expect(successes.length).toBeLessThanOrEqual(1);

    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(feedback)
      .where(eq(feedback.order_id, order.id));
    expect(c).toBeLessThanOrEqual(1);

    await cleanupTestUser(user.id);
  }, 60_000);

  it("replaying feedback event does not create duplicate feedback", async () => {
    if (!run) return;
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id, { state_version: 1 });
    await createInitialState(bp.id, user.id);
    const order = await createTestOrder(bp.id, user.id, { status: "active", started_at: new Date() });
    const key = `doc37-replay-${Date.now()}`;

    const first = await processFeedbackSubmission(
      user.id,
      feedbackPayload(order.id, bp.state_version ?? 1, key),
    );
    expect(first.feedbackId).toBeTruthy();

    const [eventRow] = await db
      .select({ id: feedback.id })
      .from(feedback)
      .where(eq(feedback.id, first.feedbackId!))
      .limit(1);
    expect(eventRow?.id).toBeTruthy();

    const replay = await processFeedbackSubmission(
      user.id,
      feedbackPayload(order.id, (bp.state_version ?? 1) + 1, key),
    ).catch((e) => e);
    if (!(replay instanceof Error)) {
      expect(replay.feedbackId).toBe(first.feedbackId);
    }

    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(feedback)
      .where(eq(feedback.order_id, order.id));
    expect(c).toBe(1);

    await cleanupTestUser(user.id);
  }, 60_000);
});

describe.skipIf(!run)("DOC 37 — concurrent blueprint activation", () => {
  it("parallel activate mutations — one succeeds, one STALE_STATE", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id, { state_version: 0, active: false });

    const activate = () =>
      mutate({
        blueprintId: bp.id,
        userId: user.id,
        expectedVersion: 0,
        mutationName: "DOC37_ACTIVATE",
        mutationFn: async (tx) => {
          await tx
            .update(blueprints)
            .set({ active: true, state_version: sql`${blueprints.state_version} + 1` })
            .where(eq(blueprints.id, bp.id));
          return { activated: true };
        },
      });

    const [r1, r2] = await Promise.allSettled([activate(), activate()]);
    const outcomes = [r1, r2].map((r) =>
      r.status === "fulfilled" ? "ok" : (r.reason as TorgimaError)?.code ?? "error",
    );
    expect(outcomes.filter((o) => o === "ok").length).toBe(1);
    expect(outcomes).toContain("STALE_STATE");

    await cleanupTestUser(user.id);
  }, 30_000);
});
