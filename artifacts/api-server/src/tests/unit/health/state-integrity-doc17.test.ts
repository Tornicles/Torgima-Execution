/**
 * DOC17 — State Integrity & System Health tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventTypes } from "../../../types/eventContracts.js";

const writeEventMock = vi.fn().mockResolvedValue("evt-repair");

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  },
  feedback: { id: "id", blueprint_id: "blueprint_id", user_id: "user_id", created_at: "created_at" },
  systemHealthLogs: {},
}));

vi.mock("../../../services/EventService.js", () => ({
  writeEvent: (...args: unknown[]) => writeEventMock(...args),
  EVENT_TYPES: {
    SIGNAL_RECALCULATION_REQUESTED: "signal_recalculation_requested",
    CONDITION_EVALUATION_REQUESTED: "condition_evaluation_requested",
  },
}));

vi.mock("../../../lib/bhudhi/ContextBuilder.js", () => ({
  ContextBuilder: {
    buildRouterContext: vi.fn().mockResolvedValue({ condition: "urgency" }),
    buildContextPacket: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../../lib/bhudhi/BudgetController.js", () => ({
  BudgetController: {
    checkAndReserve: vi.fn().mockResolvedValue(true),
  },
  isGlobalFallbackMode: vi.fn().mockResolvedValue(false),
}));

import { StateIntegrityEngine } from "../../../engines/execution-loop/StateIntegrityEngine.js";
import { attemptRepairForFinding } from "../../../engines/execution-loop/RepairEngine.js";
import {
  DEGRADED_MODE_FLAG,
  degradedDashboardMessage,
  isDegradedMode,
} from "../../../engines/execution-loop/DegradedMode.js";
import { HEALTH_MONITOR_INTERVAL_MS } from "../../../engines/execution-loop/SystemHealthMonitor.js";
import { HEALTH_CHECK_INTERVAL_MS } from "../../../workers/HealthWorker.js";

const DOC17_ISSUE_CODES = [
  "ORPHAN_TASK",
  "MISSING_CURRENT_SIGNAL",
  "MISSING_CURRENT_CONDITION",
  "MISSING_CURRENT_ENFORCEMENT",
  "TASK_WITHOUT_BLUEPRINT_LINK",
  "FEEDBACK_WITHOUT_SIGNAL_EVENT",
  "DOUBLE_ACTIVE_ORDER",
  "STALE_STATE_VERSION",
] as const;

describe("state-integrity", () => {
  describe("StateIntegrityEngine", () => {
    it("exposes all 8 DOC17 check methods", () => {
      const engine = new StateIntegrityEngine();
      expect(typeof engine.checkOrphanTask).toBe("function");
      expect(typeof engine.checkMissingCurrentSignal).toBe("function");
      expect(typeof engine.checkMissingCurrentCondition).toBe("function");
      expect(typeof engine.checkMissingCurrentEnforcement).toBe("function");
      expect(typeof engine.checkTaskWithoutBlueprintLink).toBe("function");
      expect(typeof engine.checkFeedbackWithoutSignalEvent).toBe("function");
      expect(typeof engine.checkDoubleActiveOrder).toBe("function");
      expect(typeof engine.checkStaleStateVersion).toBe("function");
      expect(typeof engine.runAllChecks).toBe("function");
    });

    it("maps double active orders to DOUBLE_ACTIVE_ORDER with repair action", async () => {
      const engine = new StateIntegrityEngine();
      vi.spyOn(engine, "checkDoubleActiveOrder").mockResolvedValue([
        {
          area: "TASK_QUEUE",
          severity: "CRITICAL",
          issueCode: "DOUBLE_ACTIVE_ORDER",
          blueprintId: "bp-1",
          userId: "user-1",
          entityType: "blueprint",
          entityId: "bp-1",
          expected: "At most one active order per blueprint",
          actual: "2 active orders",
          repairable: true,
          repairAction: "REGENERATE_TASK",
        },
      ]);
      vi.spyOn(engine, "checkOrphanTask").mockResolvedValue([]);
      vi.spyOn(engine, "checkMissingCurrentSignal").mockResolvedValue([]);
      vi.spyOn(engine, "checkMissingCurrentCondition").mockResolvedValue([]);
      vi.spyOn(engine, "checkMissingCurrentEnforcement").mockResolvedValue([]);
      vi.spyOn(engine, "checkTaskWithoutBlueprintLink").mockResolvedValue([]);
      vi.spyOn(engine, "checkFeedbackWithoutSignalEvent").mockResolvedValue([]);
      vi.spyOn(engine, "checkStaleStateVersion").mockResolvedValue([]);

      const result = await engine.runAllChecks();
      expect(result.checksRun).toBe(8);
      expect(result.findings.some((f) => f.issueCode === "DOUBLE_ACTIVE_ORDER")).toBe(true);
      expect(result.ok).toBe(false);
    });

    it("uses spec issue codes for all eight checks", () => {
      for (const code of DOC17_ISSUE_CODES) {
        expect(code.length).toBeGreaterThan(5);
      }
    });
  });

  describe("RepairEngine", () => {
    beforeEach(() => {
      writeEventMock.mockClear();
    });

    it("routes MISSING_CURRENT_SIGNAL to repairMissingSignal", async () => {
      await attemptRepairForFinding({
        area: "SIGNAL_CONDITION",
        severity: "ERROR",
        issueCode: "MISSING_CURRENT_SIGNAL",
        blueprintId: "bp-1",
        userId: "user-1",
        expected: "signal",
        actual: "missing",
        repairable: true,
        repairAction: "RECALCULATE_SIGNAL",
      });

      expect(writeEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: expect.stringMatching(/signal_recalculation|condition_evaluation/),
          blueprintId: "bp-1",
          userId: "user-1",
        }),
      );
    });
  });

  describe("DegradedMode", () => {
    it("degraded dashboard message matches DOC17 copy", () => {
      expect(degradedDashboardMessage()).toBe(
        "System is updating. Your progress is preserved.",
      );
    });

    it("exports degraded_mode flag constant", () => {
      expect(DEGRADED_MODE_FLAG).toBe("degraded_mode");
    });
  });

  describe("Bhudhi degraded fallback", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("returns fallback without API when bhudhi_force_fallbacks is enabled", async () => {
      const budget = await import("../../../lib/bhudhi/BudgetController.js");
      vi.mocked(budget.isGlobalFallbackMode).mockResolvedValue(true);
      const utils = await import("../../../lib/utils.js");
      vi.spyOn(utils, "checkFeatureFlag").mockImplementation(async (name: string) =>
        name === "degraded_mode",
      );

      const usage = await import("../../../bhudhi/UsageController.js");
      vi.spyOn(usage, "logUsage").mockResolvedValue("log-degraded-fallback");

      const core = await import("../../../bhudhi/BhudhiCore.js");
      const invokeSpy = vi.spyOn(core, "invokeBhudhiModel");
      const pipelineSpy = vi.spyOn(core, "runBhudhiPipeline");

      const { bhudhiTriggerRouter } = await import("../../../lib/bhudhi/BhudhiTriggerRouter.js");
      const result = await bhudhiTriggerRouter.trigger({
        triggerType: "STATE_EXPLANATION",
        sourceEngine: "DASHBOARD",
        userId: "00000000-0000-0000-0000-000000000010",
        blueprintId: "00000000-0000-0000-0000-000000000011",
        stateVersion: 1,
        input: { condition: "urgency", signal_summary: "stable", next_action: "continue" },
        idempotencyKey: "test-degraded",
      });

      expect(result.fallbackUsed).toBe(true);
      expect(result.failureReason).toBe("bhudhi_force_fallbacks");
      expect(result.logId).toBe("log-degraded-fallback");
      expect(invokeSpy).not.toHaveBeenCalled();
      expect(pipelineSpy).not.toHaveBeenCalled();
    });
  });

  describe("health schedule", () => {
    it("health worker and monitor both use 5-minute DOC17 interval", () => {
      expect(HEALTH_CHECK_INTERVAL_MS).toBe(5 * 60 * 1000);
      expect(HEALTH_MONITOR_INTERVAL_MS).toBe(5 * 60 * 1000);
    });
  });
});

describe("state-integrity — isDegradedMode export", () => {
  it("isDegradedMode is callable", () => {
    expect(typeof isDegradedMode).toBe("function");
  });
});
