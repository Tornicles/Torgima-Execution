/**
 * DOC 36 §3 — individual engine / loop law checks.
 */
import { describe, it, expect } from "vitest";
import { and, desc, eq, sql } from "drizzle-orm";
import { integrationEnabled, createTestUser, createTestBlueprint, createTestOrder } from "../../helpers/db.js";
import { db, feedback, events, behaviorPatterns } from "@workspace/db";
import { processFeedback } from "../../../engines/feedback/FeedbackProcessingEngine.js";
import { runAntiGamingChecks } from "../../../engines/feedback/submitFeedbackPhase1.js";
import { mutate } from "../../../services/StateMutationService.js";
import { scanForInactivity } from "../../../engines/inactivity/InactivityDetectionEngine.js";
import { EventTypes } from "../../../types/eventContracts.js";
import { computeSpecFatigueRiskScore } from "../../../engines/pattern/patternScoring.js";

const run = integrationEnabled();

describe("DOC 36 — Engine rules (unit surface)", () => {
  it("anti-gaming: effort 5 + short duration + no notes → REJECTED", () => {
    const result = runAntiGamingChecks({
      payload: {
        orderId: "00000000-0000-4000-8000-000000000001",
        completion: "COMPLETED",
        clientStateVersion: 1,
        idempotencyKey: "doc36-ag",
        effortScore: 5,
        frictionScore: 1,
        durationMinutes: 1,
        userNotes: "",
      },
      order: { proof_required: false, time_estimate_minutes: 60, difficulty: "moderate" } as never,
      recentFeedbacks: [],
    });
    expect(result.verdict).toBe("REJECTED");
  });

  it("FATIGUE_RISK formula reaches threshold", () => {
    const score = computeSpecFatigueRiskScore({
      prev7dCompletionRate: 0.8,
      curr3dCompletionRate: 0.2,
      recentTasks: [
        { effortScore: 5, notesLength: 5, durationMinutes: 2, timeEstimate: 60 },
        { effortScore: 5, notesLength: 8, durationMinutes: 1, timeEstimate: 45 },
      ],
      hardTasksLast3d: 4,
      inactivityAfterIntensity: true,
    });
    expect(score).toBeGreaterThanOrEqual(0.6);
  });

  it("failure_classification_requested event type is defined", () => {
    expect(EventTypes.FAILURE_CLASSIFICATION_REQUESTED).toBe("failure_classification_requested");
  });
});

describe.skipIf(!run)("DOC 36 — Engine rules (integration)", () => {
  it("duplicate idempotencyKey does not double-insert feedback", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id);
    const order = await createTestOrder(bp.id, user.id, { status: "active", started_at: new Date() });
    const key = `doc36-dup-${Date.now()}`;
    const a = await processFeedback({
      orderId: order.id,
      userId: user.id,
      blueprintId: bp.id,
      completionStatus: "completed",
      score: 7,
      reflection: "First submission with enough detail for validity checks to pass.",
      idempotencyKey: key,
    });
    const b = await processFeedback({
      orderId: order.id,
      userId: user.id,
      blueprintId: bp.id,
      completionStatus: "completed",
      score: 7,
      reflection: "Duplicate submission should return same feedback id.",
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
  }, 60_000);

  it("StateMutationService rejects stale expected version", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id, { state_version: 2 });
    await expect(
      mutate({
        blueprintId: bp.id,
        userId: user.id,
        expectedVersion: 1,
        mutationName: "TEST_DOC36",
        mutationFn: async () => ({ ok: true }),
      }),
    ).rejects.toMatchObject({ code: "STALE_STATE" });
  }, 30_000);

  it("FAILED feedback emits failure_classification_requested", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id);
    const order = await createTestOrder(bp.id, user.id, { status: "active", started_at: new Date() });
    await processFeedback({
      orderId: order.id,
      userId: user.id,
      blueprintId: bp.id,
      completionStatus: "failed",
      score: 3,
      reflection: "Blocked by external dependency for more than a day; could not finish.",
      blockerJson: { description: "Waiting on vendor API", type: "external_dependency" },
      idempotencyKey: `doc36-fail-${Date.now()}`,
    });

    const rows = await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.blueprint_id, bp.id),
          eq(events.event_type, EventTypes.FAILURE_CLASSIFICATION_REQUESTED),
        ),
      )
      .orderBy(desc(events.created_at))
      .limit(3);
    expect(rows.length).toBeGreaterThan(0);
  }, 60_000);

  it("inactivity scan runs without throwing", async () => {
    const result = await scanForInactivity();
    expect(result).toBeDefined();
  }, 120_000);

  it("behavior_patterns stores fatigue evidence in evidence_json", async () => {
    const user = await createTestUser();
    const [row] = await db
      .insert(behaviorPatterns)
      .values({
        user_id: user.id,
        pattern_type: "burnout",
        status: "active",
        evidence_json: { spec_label: "FATIGUE_RISK", doc36: true },
        confidence: 0.8,
      })
      .returning();
    expect((row?.evidence_json as { spec_label?: string })?.spec_label).toBe("FATIGUE_RISK");
  }, 30_000);
});
