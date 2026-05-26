import { describe, expect, it } from "vitest";
import type { ExecutionHistoryEntry } from "../../../types/ultimate.js";
import { computeSequenceLocked } from "../../../engines/sequence/SequenceTracker.js";
import { ULTIMATE_SEQUENCE_NUMBER } from "../../../engines/ultimate/ultimateGate.js";

function completionRate(history: ExecutionHistoryEntry[]): number {
  const completed = history.filter((h) => h.completed).length;
  return completed / Math.max(history.length, 1);
}

function identifyBlockers(history: ExecutionHistoryEntry[]): string[] {
  const blockers: Record<string, number> = {};
  for (const h of history) {
    for (const b of h.blockersEncountered) {
      blockers[b] = (blockers[b] ?? 0) + 1;
    }
  }
  return Object.entries(blockers)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([b]) => b);
}

describe("Ultimate services (Prompt 3)", () => {
  it("computes completion rate from history", () => {
    const rate = completionRate([
      { taskName: "a", estimatedMinutes: 30, actualMinutes: 30, completed: true, blockersEncountered: [] },
      { taskName: "b", estimatedMinutes: 30, actualMinutes: 30, completed: false, blockersEncountered: [] },
    ]);
    expect(rate).toBe(0.5);
  });

  it("identifies common blockers", () => {
    const blockers = identifyBlockers([
      {
        taskName: "a",
        estimatedMinutes: 30,
        actualMinutes: 30,
        completed: false,
        blockersEncountered: ["technical"],
      },
      {
        taskName: "b",
        estimatedMinutes: 30,
        actualMinutes: 30,
        completed: false,
        blockersEncountered: ["technical"],
      },
    ]);
    expect(blockers).toContain("technical");
  });

  it("locks sequence 25 for Growth tier", () => {
    expect(computeSequenceLocked(ULTIMATE_SEQUENCE_NUMBER, "Growth", [24])).toBe(true);
  });

  it("unlocks sequence 25 for Ultimate with prerequisite 24", () => {
    expect(computeSequenceLocked(ULTIMATE_SEQUENCE_NUMBER, "Ultimate", [24])).toBe(false);
  });

  it("locks sequence 25 for Ultimate without prerequisite 24", () => {
    expect(computeSequenceLocked(ULTIMATE_SEQUENCE_NUMBER, "Ultimate", [23])).toBe(true);
  });
});
