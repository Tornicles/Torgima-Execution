/**
 * DOC 36 §5 — database integrity after loop.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { integrationEnabled } from "../../helpers/db.js";
import { collectDoc36GlobalIntegrity } from "../../helpers/doc36-loop-runner.js";
import { ensureDoc36E2eReady } from "./global-setup.js";

const run = integrationEnabled();

describe.skipIf(!run)("DOC 36 — Database integrity", () => {
  beforeAll(async () => {
    await ensureDoc36E2eReady();
  }, 120_000);

  it("no pending events past process_after", async () => {
    const { pendingEvents } = await collectDoc36GlobalIntegrity();
    expect(pendingEvents).toBe(0);
  });

  it("no orphaned orders in sample window", async () => {
    const { orphanedOrders } = await collectDoc36GlobalIntegrity();
    expect(orphanedOrders).toBe(0);
  });

  it("no critical system_health_logs in the last hour", async () => {
    const { criticalHealthLogs } = await collectDoc36GlobalIntegrity();
    expect(criticalHealthLogs).toBe(0);
  });

  it("no unreviewed dead_letter_events", async () => {
    const { unreviewedDeadLetters } = await collectDoc36GlobalIntegrity();
    expect(unreviewedDeadLetters).toBe(0);
  });
});
