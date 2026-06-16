/**
 * DOC 36 §2 — primary full loop test (`loop.test.ts` per spec).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, orders, feedback, signalSnapshots } from "@workspace/db";
import { integrationEnabled } from "../../helpers/db.js";
import { resetDoc36TestUser, doc36HasActiveBlueprint } from "../../helpers/doc36-reset.js";
import {
  collectDoc36PostLoopDbState,
  collectDoc36GlobalIntegrity,
  runDoc36FullLoop,
} from "../../helpers/doc36-loop-runner.js";
import { DOC36_LOOP_BUDGET_MS, DOC36_TIMING } from "../../helpers/doc36-constants.js";
import { waitForEvent } from "../../helpers/doc36-event-wait.js";
import { ensureDoc36E2eReady } from "./global-setup.js";

const run = integrationEnabled();

describe.skipIf(!run)("DOC 36 — Full execution loop (loop.test.ts)", () => {
  let userId: string;

  beforeAll(async () => {
    await ensureDoc36E2eReady();
    const reset = await resetDoc36TestUser();
    userId = reset.userId;
    expect(await doc36HasActiveBlueprint(userId)).toBe(false);
  }, 120_000);

  afterAll(async () => {
    if (userId) await resetDoc36TestUser();
    const integrity = await collectDoc36GlobalIntegrity();
    expect(integrity.criticalHealthLogs).toBe(0);
    expect(integrity.unreviewedDeadLetters).toBe(0);
    expect(integrity.pendingEvents).toBe(0);
  }, 120_000);

  it("completes full execution loop in under 10 seconds", async () => {
    const startTime = Date.now();
    const result = await runDoc36FullLoop(userId);

    expect(result.firstOrderId).toBeTruthy();
    expect(result.nextOrderId).toBeTruthy();
    expect(result.nextOrderId).not.toBe(result.firstOrderId);

    const [orderRow] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, result.firstOrderId))
      .limit(1);
    expect(orderRow?.status).toBe("completed");

    const [fbRow] = await db
      .select({ validity: feedback.validity })
      .from(feedback)
      .where(eq(feedback.id, result.feedbackId))
      .limit(1);
    expect(fbRow?.validity).toMatch(/valid/i);

    const [sig] = await db
      .select({ completion_rate: signalSnapshots.completion_rate })
      .from(signalSnapshots)
      .where(
        and(eq(signalSnapshots.blueprint_id, result.blueprintId), eq(signalSnapshots.is_current, true)),
      )
      .limit(1);
    expect(Number(sig?.completion_rate ?? 0)).toBeGreaterThan(0);

    const since = new Date(startTime);
    await waitForEvent("signal_calculated", result.blueprintId, DOC36_TIMING.signalRecalcMaxMs, since).catch(
      () => null,
    );
    await waitForEvent("condition_evaluated", result.blueprintId, 2_000, since).catch(() => null);
    await waitForEvent("enforcement_package_created", result.blueprintId, 2_000, since).catch(
      () => null,
    );
    await waitForEvent("order_available", result.blueprintId, DOC36_TIMING.initialTaskMaxMs, since).catch(
      () => null,
    );

    const dbState = await collectDoc36PostLoopDbState(result.blueprintId, result.feedbackId);
    expect(dbState.signalSnapshots).toBeGreaterThanOrEqual(1);
    expect(dbState.conditions).toBeGreaterThanOrEqual(1);
    expect(dbState.enforcementPackages).toBeGreaterThanOrEqual(1);
    expect(dbState.feedbackPresent).toBe(true);

    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(DOC36_LOOP_BUDGET_MS);
    expect(result.elapsedMs).toBeLessThan(DOC36_LOOP_BUDGET_MS);
    // eslint-disable-next-line no-console
    console.log(`Full loop completed in ${totalTime}ms`);
  }, 180_000);
});
