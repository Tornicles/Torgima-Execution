import { describe, it, expect } from "vitest";
import { assertEventQueueContract } from "../../types/eventContracts.js";
import { formatSimulationReport, type SimulationReport } from "../../simulation/fourteenDaySimulation.js";
import { integrationEnabled } from "../helpers/db.js";

describe("14-day simulation — contracts", () => {
  it("event queue contract is complete", () => {
    const { ok, mismatches } = assertEventQueueContract();
    expect(ok).toBe(true);
    expect(mismatches).toEqual([]);
  });

  it("formats final report", () => {
    const report: SimulationReport = {
      ok: true,
      blueprintId: "bp-1",
      userId: "u-1",
      daysCompleted: 14,
      totalTasksGenerated: 120,
      totalFeedback: 95,
      deadLetterCount: 0,
      breaks: [],
      finalCondition: "power",
      highestMomentum: 8,
      conditionTransitions: ["Day 1: nothingness → stability"],
      daySummaries: [{ day: 1, tasks: 8, feedback: 5, condition: "stability", momentum: 1 }],
      errors: [],
    };
    const text = formatSimulationReport(report);
    expect(text).toContain("TORGIMA 14-DAY SIMULATION REPORT");
    expect(text).toContain("power");
  });
});

describe.skipIf(!integrationEnabled())("14-day simulation — live Postgres", () => {
  it("runs full 14-day SaaS creator journey", async () => {
    const { run14DaySimulation } = await import("../../simulation/fourteenDaySimulation.js");
    const report = await run14DaySimulation();
    expect(report.daysCompleted).toBeGreaterThanOrEqual(10);
    expect(report.totalTasksGenerated).toBeGreaterThan(50);
    expect(report.deadLetterCount).toBe(0);
    expect(report.finalCondition).not.toBe("nothingness");
  }, 600_000);
});
