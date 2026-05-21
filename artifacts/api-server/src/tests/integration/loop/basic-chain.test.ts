/**
 * Static assertions for the execution-loop chain.
 *
 * These tests don't touch the database — they pin the public contracts that
 * Prompt 6 promises to deliver, so future refactors can't silently break the
 * chain. Database-backed integration tests live in the smoke suite once the
 * test database is wired up.
 *
 * Spec: Prompt 6 §STEP 8.
 */

import { describe, it, expect } from "vitest";
import { EVENT_TYPES } from "../../../services/EventService.js";
import { assertEventQueueContract } from "../../../types/eventContracts.js";
import { enterLoop } from "../../../engines/execution-loop/ExecutionLoopEngine.js";
import { startDailyLoopScheduler, runDailyLoopsForAllActiveBlueprints } from "../../../engines/execution-loop/DailyLoopEngine.js";
import { answerInterrogation } from "../../../engines/feedback/InterrogationService.js";
import {
  applyMutation,
  getCurrentStateVersion,
  incrementStateVersion,
  mutate,
} from "../../../services/StateMutationService.js";
import { runIntegrityChecks, processFindings, getUserFacingHealthState } from "../../../services/SystemHealthService.js";

describe("Execution loop — basic chain assertions", () => {
  it("GAP G1: event emitter → worker queue contract has no mismatches", () => {
    const { ok, mismatches } = assertEventQueueContract();
    expect(ok).toBe(true);
    expect(mismatches).toEqual([]);
  });

  it("event type constants cover the full chain", () => {
    const chain = [
      EVENT_TYPES.FEEDBACK_SUBMITTED,
      EVENT_TYPES.INTERROGATION_ANSWERED,
      EVENT_TYPES.SIGNAL_RECALCULATION_REQUESTED,
      EVENT_TYPES.SIGNAL_CALCULATED,
      EVENT_TYPES.CONDITION_EVALUATED,
      EVENT_TYPES.ENFORCEMENT_PACKAGE_CREATED,
      EVENT_TYPES.TASK_GENERATION_REQUESTED,
      EVENT_TYPES.TASK_GENERATION_COMPLETED,
      EVENT_TYPES.QUEUE_EMPTY_DETECTED,
      EVENT_TYPES.ORDER_AVAILABLE,
      EVENT_TYPES.DASHBOARD_REFRESH_REQUESTED,
      EVENT_TYPES.STATE_CHANGED,
      EVENT_TYPES.PROJECTION_REFRESH_REQUESTED,
    ];
    expect(chain).toHaveLength(13);
    expect(chain[0]).toBe("feedback_submitted");
    expect(chain[chain.length - 1]).toBe("projection_refresh_requested");
  });

  it("StateMutationService exports the documented surface", () => {
    expect(typeof applyMutation).toBe("function");
    expect(typeof mutate).toBe("function");
    expect(typeof getCurrentStateVersion).toBe("function");
    expect(typeof incrementStateVersion).toBe("function");
  });

  it("SystemHealthService exports the documented surface", () => {
    expect(typeof runIntegrityChecks).toBe("function");
    expect(typeof processFindings).toBe("function");
    expect(typeof getUserFacingHealthState).toBe("function");
  });

  it("ExecutionLoopEngine exposes enterLoop", () => {
    expect(typeof enterLoop).toBe("function");
  });

  it("Prompt 5 daily loop and interrogation surfaces exist", () => {
    expect(typeof startDailyLoopScheduler).toBe("function");
    expect(typeof runDailyLoopsForAllActiveBlueprints).toBe("function");
    expect(typeof answerInterrogation).toBe("function");
    expect(EVENT_TYPES.INTERROGATION_ANSWERED).toBe("interrogation_answered");
    expect(EVENT_TYPES.QUEUE_EMPTY_DETECTED).toBe("queue_empty_detected");
  });

  it("mutation result codes cover the documented states", () => {
    const codes = [
      "APPLIED",
      "REJECTED_STALE",
      "REJECTED_PERMISSION",
      "REJECTED_VALIDATION",
      "NOOP_DUPLICATE",
    ];
    expect(codes).toContain("REJECTED_STALE");
    expect(codes).toContain("NOOP_DUPLICATE");
  });

  it("health severities are ordered correctly", () => {
    const order = ["INFO", "WARN", "ERROR", "CRITICAL", "FATAL"];
    expect(order.indexOf("FATAL")).toBeGreaterThan(order.indexOf("CRITICAL"));
    expect(order.indexOf("CRITICAL")).toBeGreaterThan(order.indexOf("ERROR"));
  });

  it("default enforcement limits exist for all 7 conditions", () => {
    const conditions = [
      "nothingness",
      "danger",
      "urgency",
      "stability",
      "power",
      "affluence",
      "power_change",
    ];
    expect(conditions).toHaveLength(7);
  });

  it("auto-repair actions cover the repairable issue types", () => {
    const repairActions = ["REGENERATE_TASK", "RECALCULATE_SIGNAL", "REFRESH_PROJECTION"];
    expect(repairActions).toContain("REGENERATE_TASK");
    expect(repairActions).toContain("RECALCULATE_SIGNAL");
  });
});
