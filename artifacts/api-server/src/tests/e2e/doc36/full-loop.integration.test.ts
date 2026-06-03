/**
 * DOC 36 — primary full loop (integration / real Postgres).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { integrationEnabled } from "../../helpers/db.js";
import { resetDoc36TestUser, doc36HasActiveBlueprint } from "../../helpers/doc36-reset.js";
import {
  collectDoc36PostLoopDbState,
  runDoc36FullLoop,
} from "../../helpers/doc36-loop-runner.js";
import { DOC36_LOOP_BUDGET_MS } from "../../helpers/doc36-constants.js";

const run = integrationEnabled();

describe.skipIf(!run)("DOC 36 — Full execution loop", () => {
  let userId: string;

  beforeAll(async () => {
    const reset = await resetDoc36TestUser();
    userId = reset.userId;
    expect(await doc36HasActiveBlueprint(userId)).toBe(false);
  }, 120_000);

  afterAll(async () => {
    if (userId) await resetDoc36TestUser();
  }, 120_000);

  it("onboarding → first task → feedback → next task within budget", async () => {
    const result = await runDoc36FullLoop(userId);
    expect(result.firstOrderId).toBeTruthy();
    expect(result.nextOrderId).toBeTruthy();
    expect(result.nextOrderId).not.toBe(result.firstOrderId);
    expect(result.elapsedMs).toBeLessThan(DOC36_LOOP_BUDGET_MS);

    const dbState = await collectDoc36PostLoopDbState(result.blueprintId, result.feedbackId);
    expect(dbState.signalSnapshots).toBeGreaterThanOrEqual(1);
    expect(dbState.conditions).toBeGreaterThanOrEqual(1);
    expect(dbState.conditionRecords).toBeGreaterThanOrEqual(1);
    expect(dbState.enforcementPackages).toBeGreaterThanOrEqual(1);
    expect(dbState.feedbackPresent).toBe(true);
    expect(dbState.completionReward).toBe(true);
  }, 180_000);
});
