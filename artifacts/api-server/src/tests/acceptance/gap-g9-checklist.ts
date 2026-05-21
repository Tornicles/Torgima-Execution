/**
 * GAP G9 — Phase 1 acceptance checklist constants (DOC_36 / DOC_37).
 */

import { EventTypes } from "../../types/eventContracts.js";

/** Required causal event sequence after feedback (live event names). */
export const G9_FEEDBACK_EVENT_CHAIN: readonly string[] = [
  EventTypes.FEEDBACK_SUBMITTED,
  EventTypes.SIGNAL_RECALCULATION_REQUESTED,
  EventTypes.SIGNAL_CALCULATED,
  EventTypes.CONDITION_EVALUATED,
  EventTypes.ENFORCEMENT_PACKAGE_CREATED,
  EventTypes.TASK_GENERATION_COMPLETED,
  EventTypes.ORDER_AVAILABLE,
];

export const G9_PERFORMANCE_GATES = {
  onboardingGoalToFirstTaskMs: { target: 30_000, hardFail: 60_000 },
  feedbackToNextTaskMs: { target: 5_000, hardFail: 10_000 },
  activeOrderGetMs: { target: 500, hardFail: 2_000 },
  dashboardGetMs: { target: 800, hardFail: 3_000 },
  healthCheckAllBlueprintsMs: { target: 10_000, hardFail: 30_000 },
} as const;

export type G9ItemResult = {
  item: number;
  label: string;
  pass: boolean;
  note?: string;
};

export function g9Item(item: number, label: string, pass: boolean, note?: string): G9ItemResult {
  return { item, label, pass, note };
}

export function formatG9Report(results: G9ItemResult[]): string {
  const lines = ["GAP PROMPT G9 — FULL PHASE 1 ACCEPTANCE REPORT", ""];
  const sections: Array<[string, number[]]> = [
    ["Section A — Core Execution Loop", [1, 2, 3, 4, 5, 6, 7]],
    ["Section B — Infrastructure", [8, 9, 10, 11, 12]],
    ["Section C — Bhudhi", [13, 14, 15]],
    ["Section D — Data Integrity", [16, 17, 18]],
    ["Section E — API Contract", [19, 20]],
  ];

  for (const [title, nums] of sections) {
    lines.push(title);
    for (const n of nums) {
      const r = results.find((x) => x.item === n);
      const status = r?.pass ? "PASS" : "FAIL";
      lines.push(`  Item ${n}  (${r?.label ?? "?"}): ${status}${r?.note ? ` — ${r.note}` : ""}`);
    }
    lines.push("");
  }

  const failed = results.filter((r) => !r.pass);
  const overall = failed.length === 0 ? "PASS" : "FAIL";
  lines.push(`OVERALL RESULT: ${overall}`);
  if (failed.length > 0) {
    lines.push(`Failing items: ${failed.map((f) => f.item).join(", ")}`);
  }
  return lines.join("\n");
}
