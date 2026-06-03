/**
 * DOC 36 §5 — database integrity after loop.
 */
import { describe, it, expect } from "vitest";
import { integrationEnabled } from "../../helpers/db.js";
import { collectDoc36GlobalIntegrity } from "../../helpers/doc36-loop-runner.js";

const run = integrationEnabled();

describe.skipIf(!run)("DOC 36 — Database integrity", () => {
  it("no events stuck PENDING > 5 minutes (sample)", async () => {
    const { pendingEvents } = await collectDoc36GlobalIntegrity();
    expect(pendingEvents).toBe(0);
  });

  it("no orphaned orders in sample window", async () => {
    const { orphanedOrders } = await collectDoc36GlobalIntegrity();
    expect(orphanedOrders).toBe(0);
  });
});
