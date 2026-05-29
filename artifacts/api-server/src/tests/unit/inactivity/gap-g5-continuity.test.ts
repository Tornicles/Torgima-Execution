/**
 * GAP PROMPT G5 — Execution Continuity / Inactivity tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

function drizzleWhereEnd(rows: unknown[]) {
  const end = {
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn(() => drizzleWhereEnd(rows)),
    then(
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    },
  };
  return end;
}

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => drizzleWhereEnd([{ id: "bp-a", user_id: "u-a" }])),
      })),
    })),
  },
  blueprints: {
    id: { name: "id" },
    user_id: { name: "user_id" },
    active: { name: "active" },
    status: { name: "status" },
    current_phase_id: { name: "current_phase_id" },
  },
  phases: {
    id: { name: "id" },
    blueprint_id: { name: "blueprint_id" },
    order_index: { name: "order_index" },
  },
}));

vi.mock("../../../engines/task-engine/TaskEngine.js", () => ({
  revealAllDueTasksGlobal: vi.fn().mockResolvedValue(0),
  topOffTaskQueuesForActiveBlueprints: vi.fn().mockResolvedValue(0),
}));

vi.mock("../../../engines/execution-loop/DailyLoopEngine.js", () => ({
  runDailyLoopsForAllActiveBlueprints: vi.fn().mockResolvedValue(1),
}));

import {
  classifyInactivity,
  requiresRecoveryEvent,
  INACTIVITY_DOC11_THRESHOLDS,
} from "../../../engines/inactivity/InactivityThresholds.js";
import { InactivityDetectionEngine, isBlueprintEligibleForInactivityScan } from "../../../engines/inactivity/InactivityDetectionEngine.js";
import { EventTypes } from "../../../types/eventContracts.js";
import {
  runHourlyInactivityScan,
  runDailyTaskCycle,
  startExecutionContinuitySchedulers,
  stopExecutionContinuitySchedulers,
} from "../../../schedulers/ExecutionContinuityScheduler.js";

describe("GAP G5 — DOC_11 classification", () => {
  it("T1: 30h inactive → MISSED_DUE_WINDOW / MEDIUM / soft", () => {
    const c = classifyInactivity(30);
    expect(c).not.toBeNull();
    expect(c!.type).toBe("MISSED_DUE_WINDOW");
    expect(c!.severity).toBe("MEDIUM");
    expect(c!.thresholdBreached).toBe("soft");
    expect(requiresRecoveryEvent(c!.thresholdBreached)).toBe(true);
  });

  it("T2: 24h+ triggers recovery event path", () => {
    const c = classifyInactivity(25);
    expect(requiresRecoveryEvent(c!.thresholdBreached)).toBe(true);
  });

  it("T3: 14d+ (336h) → CRITICAL abandonment", () => {
    const c = classifyInactivity(340);
    expect(c!.type).toBe("ABANDONED_LOOP");
    expect(c!.severity).toBe("CRITICAL");
    expect(c!.thresholdBreached).toBe("critical");
    expect(INACTIVITY_DOC11_THRESHOLDS.critical_abandonment).toBe(336);
  });

  it("2h → NO_FEEDBACK / LOW (reminder only)", () => {
    const c = classifyInactivity(3);
    expect(c!.type).toBe("NO_FEEDBACK");
    expect(c!.severity).toBe("LOW");
    expect(requiresRecoveryEvent(c!.thresholdBreached)).toBe(false);
  });
});

describe("GAP G5 — eligibility laws", () => {
  it("T4: paused and complete blueprints are not eligible", async () => {
    const lockMod = await import("../../../engines/health/ExecutionLock.js");
    vi.spyOn(lockMod, "isBlueprintExecutionLocked").mockResolvedValue({ locked: false });

    expect(await isBlueprintEligibleForInactivityScan("bp-1", "paused", true)).toBe(false);
    expect(await isBlueprintEligibleForInactivityScan("bp-2", "complete", true)).toBe(false);
    expect(await isBlueprintEligibleForInactivityScan("bp-3", "active", false)).toBe(false);
    expect(await isBlueprintEligibleForInactivityScan("bp-4", "active", true)).toBe(true);
  });

  it("health-locked blueprint is skipped", async () => {
    const lockMod = await import("../../../engines/health/ExecutionLock.js");
    vi.spyOn(lockMod, "isBlueprintExecutionLocked").mockResolvedValue({
      locked: true,
      issueCode: "CRITICAL",
    });
    expect(await isBlueprintEligibleForInactivityScan("bp-5", "active", true)).toBe(false);
  });
});

describe("GAP G5 — event contracts", () => {
  it("INACTIVITY_DETECTED routes to task generation", async () => {
    const { EVENT_QUEUE_MAP } = await import("../../../types/eventContracts.js");
    expect(EVENT_QUEUE_MAP[EventTypes.INACTIVITY_DETECTED]).toBe("task_generation_requested");
    expect(EventTypes.INACTIVITY_SCAN_REQUESTED).toBe("inactivity_scan_requested");
  });
});

describe("GAP G5 — schedulers", () => {
  beforeEach(() => {
    stopExecutionContinuitySchedulers();
    vi.useFakeTimers();
  });

  it("T5: hourly inactivity scan registers 60m interval", async () => {
    const scanMod = await import("../../../engines/inactivity/InactivityDetectionEngine.js");
    const scanSpy = vi.spyOn(scanMod, "scanForInactivity").mockResolvedValue({
      scanned: 0,
      detected: 0,
      resolved: 0,
      skipped: 0,
    });

    startExecutionContinuitySchedulers();
    await vi.runOnlyPendingTimersAsync();
    expect(scanSpy).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(scanSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

    stopExecutionContinuitySchedulers();
    vi.useRealTimers();
  });

  it("daily task cycle emits TASK_GENERATION_REQUESTED per blueprint", async () => {
    vi.useRealTimers();
    const eventMod = await import("../../../services/EventService.js");
    const writeSpy = vi.spyOn(eventMod, "writeEvent").mockResolvedValue("evt-1");

    await runDailyTaskCycle();

    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: EventTypes.TASK_GENERATION_REQUESTED,
        blueprintId: "bp-a",
        payload: expect.objectContaining({ trigger: "daily_cycle" }),
      }),
    );
  });

  it("hourly scan writes INACTIVITY_SCAN_REQUESTED", async () => {
    const scanMod = await import("../../../engines/inactivity/InactivityDetectionEngine.js");
    vi.spyOn(scanMod, "scanForInactivity").mockResolvedValue({
      scanned: 1,
      detected: 0,
      resolved: 0,
      skipped: 0,
    });

    const eventMod = await import("../../../services/EventService.js");
    const writeSpy = vi.spyOn(eventMod, "writeEvent").mockResolvedValue("evt-2");

    await runHourlyInactivityScan();

    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: EventTypes.INACTIVITY_SCAN_REQUESTED }),
    );
  });
});

describe("GAP G5 — engine surface", () => {
  it("InactivityDetectionEngine exposes classify helper", () => {
    const engine = new InactivityDetectionEngine();
    expect(typeof engine.scan).toBe("function");
    expect(InactivityDetectionEngine.classify(48)?.type).toBe("MISSED_DUE_WINDOW");
  });
});
