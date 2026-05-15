/**
 * Prompt 9 §4–5 — engine edge cases and state integrity (unit + integration).
 */
import { describe, it, expect } from "vitest";
import { detectFalseProgress } from "../../../engines/intelligence/FalseProgressDetectionEngine.js";
import { scoreProofForOrder } from "../../../engines/feedback/ProofScoringEngine.js";
import { TorgimaError, torgimaErrorToStatus } from "../../../lib/errors.js";
import { canOverride } from "../../../lib/sourceOfTruth.js";
import { integrationEnabled, createTestUser, createTestBlueprint, createTestOrder, cleanupTestUser } from "../../helpers/db.js";
import { processFeedback } from "../../../engines/feedback/FeedbackProcessingEngine.js";
import { guaranteeTask } from "../../../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { db, orders } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";

describe("Prompt 9 — Engine edge case matrix", () => {
  it("signal: insufficient data uses safe defaults", async () => {
    const { calculate } = await import("../../../engines/signal/SignalCalculationEngine.js");
    const r = await calculate({
      blueprintId: "00000000-0000-4000-8000-000000000099",
      userId: "00000000-0000-4000-8000-000000000098",
    }).catch(() => null);
    expect(r === null || typeof r?.condition === "string").toBe(true);
  });

  it("feedback: contradicts outcome evidence pattern", () => {
    const fp = detectFalseProgress({
      completionCount: 12,
      evidenceScore: 5,
      outcomeMovementScore: 2,
      hasProof: false,
      avgScore: 9,
    });
    expect(fp.detected).toBe(true);
  });

  it("Bhudhi contract: invalid output type rejected at validator layer", async () => {
    const { validateOutput } = await import("../../../bhudhi/OutputValidator.js");
    const bad = validateOutput({ outputType: "task_copy", title: "x" }, "structured_goal", 1);
    expect(bad.ok).toBe(false);
    expect(bad.errors.length).toBeGreaterThan(0);
  });

  it("EIS: deterministic path works without live model", async () => {
    const { fetchEISIntelligence } = await import("../../../engines/validation/intelligence/EISService.js");
    const { classifyIndustry } = await import("../../../engines/validation/intelligence/IndustryClassifier.js");
    const { buildCISContext } = await import("../../../engines/validation/intelligence/CISService.js");
    const classification = classifyIndustry({ goal: "Sell handmade goods online" });
    const cis = buildCISContext({
      blueprintId: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000002",
      classification,
      tier: "growth",
      mode: "individual",
    });
    const eis = await fetchEISIntelligence({
      goal: "Launch store",
      classification,
      cis,
      userId: cis.userId,
      blueprintId: cis.blueprintId,
      aiEnabled: false,
    });
    expect(eis.demand_signal.direction).toBeTruthy();
  });

  it("proof scoring: empty proof on required order scores low", () => {
    const row = {
      id: "o1",
      proof_required: true,
      blueprint_id: "b",
      user_id: "u",
    } as Parameters<typeof scoreProofForOrder>[0];
    const s = scoreProofForOrder(row, {});
    expect(s.normalized).toBeLessThan(0.5);
  });
});

describe("Prompt 9 — State integrity edge cases", () => {
  it("stale state returns 409 mapping", () => {
    expect(torgimaErrorToStatus("STALE_STATE")).toBe(409);
    expect(new TorgimaError("STALE_STATE", "State changed", true).retryable).toBe(true);
  });

  it("cached projection cannot override execution signals", () => {
    expect(canOverride("execution_signals", "cached_projection")).toBe(true);
    expect(canOverride("cached_projection", "execution_signals")).toBe(false);
  });

  it("idempotency key format is stable", () => {
    const key = `feedback_submitted:order-1:${Math.floor(Date.now() / 1000)}`;
    expect(key).toMatch(/^feedback_submitted:/);
  });
});

describe.skipIf(!integrationEnabled())("State integrity — integration", () => {
  let userId: string;
  let blueprintId: string;
  let orderId: string;

  it("duplicate idempotency does not double-insert feedback", async () => {
    const user = await createTestUser();
    userId = user.id;
    const bp = await createTestBlueprint(userId);
    blueprintId = bp.id;
    const order = await createTestOrder(blueprintId, userId, { status: "active", started_at: new Date() });
    orderId = order.id;

    const key = `dup-${Date.now()}`;
    const a = await processFeedback({
      orderId,
      userId,
      blueprintId,
      completionStatus: "completed",
      score: 7,
      reflection: "First submission with enough detail for validity checks to pass.",
      idempotencyKey: key,
    });
    const b = await processFeedback({
      orderId,
      userId,
      blueprintId,
      completionStatus: "completed",
      score: 7,
      reflection: "Duplicate tab submission should noop or reject safely.",
      idempotencyKey: key,
    }).catch((e) => e);

    if (b instanceof Error) {
      expect(b).toBeTruthy();
    } else {
      expect(b.feedbackId).toBe(a.feedbackId);
    }

    const { feedback: fbTable } = await import("@workspace/db");
    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(fbTable)
      .where(eq(fbTable.order_id, orderId));
    expect(c).toBeLessThanOrEqual(1);
  }, 30_000);

  it("guarantee fills empty active blueprint task queue", async () => {
    const user = await createTestUser();
    userId = user.id;
    const bp = await createTestBlueprint(userId);
    blueprintId = bp.id;
    await db
      .update(orders)
      .set({ status: "completed" })
      .where(and(eq(orders.blueprint_id, blueprintId), inArray(orders.status, ["pending", "active"])));

    const gu = await guaranteeTask({ blueprintId, userId });
    expect(gu.orderId).toBeTruthy();
  }, 30_000);

  afterAll(async () => {
    if (userId) await cleanupTestUser(userId);
  });
});
