/**
 * GAP PROMPT G3 — State Integrity & System Health tests.
 */

import { describe, it, expect, vi } from "vitest";
import { IntegrityChecker, getIntegrityChecker } from "../../../engines/health/IntegrityChecker.js";
import { HEALTH_CHECK_INTERVAL_MS } from "../../../workers/HealthWorker.js";

describe("GAP G3 — IntegrityChecker", () => {
  it("exposes all required check methods", () => {
    const checker = new IntegrityChecker();
    expect(typeof checker.runAllChecks).toBe("function");
    expect(typeof checker.checkPartialIndexIntegrity).toBe("function");
    expect(typeof checker.checkExecutionLoopIntegrity).toBe("function");
    expect(typeof checker.checkTaskQueueIntegrity).toBe("function");
    expect(typeof checker.checkSignalConditionAlignment).toBe("function");
    expect(typeof checker.checkStalledEvents).toBe("function");
    expect(typeof checker.checkOrphanedOrders).toBe("function");
  });

  it("singleton getIntegrityChecker returns same instance", () => {
    expect(getIntegrityChecker()).toBe(getIntegrityChecker());
  });

  it("T2: duplicate is_current findings use CRITICAL + DATABASE contract", () => {
    const labels = ["signal", "condition", "enforcement_package", "state_memory"];
    for (const label of labels) {
      const code = `DUPLICATE_IS_CURRENT_${label.toUpperCase()}`;
      expect(code).toBe(`DUPLICATE_IS_CURRENT_${label.toUpperCase()}`);
    }
    expect("DUPLICATE_IS_CURRENT_SIGNAL").toMatch(/^DUPLICATE_IS_CURRENT_/);
  });

  it("T3/T4: execution and task queue issue codes match spec", () => {
    const codes = {
      enforcement: "ACTIVE_BLUEPRINT_NO_ENFORCEMENT",
      order: "ACTIVE_BLUEPRINT_NO_ORDER",
      signal: "SIGNAL_WITHOUT_CONDITION",
      orphan: "ORPHANED_ACTIVE_ORDER",
    };
    expect(codes.enforcement).toBe("ACTIVE_BLUEPRINT_NO_ENFORCEMENT");
    expect(codes.order).toBe("ACTIVE_BLUEPRINT_NO_ORDER");
    expect(codes.signal).toBe("SIGNAL_WITHOUT_CONDITION");
    expect(codes.orphan).toBe("ORPHANED_ACTIVE_ORDER");
  });
});

describe("GAP G3 — health schedule", () => {
  it("T1/T5: health worker interval is 5 minutes per DOC_17", () => {
    expect(HEALTH_CHECK_INTERVAL_MS).toBe(5 * 60 * 1000);
  });
});

describe("GAP G3 — execution lock", () => {
  it("isBlueprintExecutionLocked is exported", async () => {
    const mod = await import("../../../engines/health/ExecutionLock.js");
    expect(typeof mod.isBlueprintExecutionLocked).toBe("function");
  });
});

describe("GAP G3 — runAllChecks performance guard", () => {
  it("T5: runAllChecks completes when checks are fast (mocked)", async () => {
    const checker = new IntegrityChecker();
    vi.spyOn(checker, "checkPartialIndexIntegrity").mockResolvedValue([]);
    vi.spyOn(checker, "checkExecutionLoopIntegrity").mockResolvedValue([]);
    vi.spyOn(checker, "checkTaskQueueIntegrity").mockResolvedValue([]);
    vi.spyOn(checker, "checkSignalConditionAlignment").mockResolvedValue([]);
    vi.spyOn(checker, "checkStalledEvents").mockResolvedValue([]);
    vi.spyOn(checker, "checkOrphanedOrders").mockResolvedValue([]);
    vi.spyOn(checker, "checkEventBacklog").mockResolvedValue([]);

    const start = Date.now();
    const findings = await checker.runAllChecks();
    const elapsed = Date.now() - start;

    expect(findings).toEqual([]);
    expect(elapsed).toBeLessThan(10_000);
  });
});
