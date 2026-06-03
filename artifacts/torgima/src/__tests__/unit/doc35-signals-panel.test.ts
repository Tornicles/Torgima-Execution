import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { freshnessFromAgeMs, toSignalsPanelProjection } from "@/lib/signals-panel";
import { LANGUAGE } from "@/lib/language";
import type { DashboardProjection } from "@/lib/dashboard-types";

const root = resolve(import.meta.dirname, "../../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

const baseProjection = {
  hasActiveBlueprint: true,
  stateVersion: 1,
  conditionLabel: "Steady Progress",
  signal_breakdown: {
    completion_rate: 0.72,
    weighted_score: 7.2,
    momentum: 3,
    trend: "improving",
    confidence: "high",
    tasks_in_window: 8,
    condition: "stability",
    formula_steps: [],
    matched_rule: {
      condition: "stability",
      rule_description: "",
      your_value: "",
      threshold: "",
    },
    window_start: "",
    window_end: "",
    snapshot_id: "s1",
    generated_at: new Date().toISOString(),
  },
  activeCondition: {
    condition: "stability",
    allowed_actions: ["task_execution", "feedback_submission"],
    blocked_actions: ["scaling_tasks"],
  },
  identity: { stage: "BUILDING" },
  tasksCompletedThisWeek: 12,
  streakDays: 5,
  blueprintTier: "starter",
} as unknown as DashboardProjection;

describe("DOC 35 — Signal, condition & identity panel", () => {
  it("signals page uses dashboard projection only", () => {
    const page = readRepo("src/pages/signals.tsx");
    expect(page).toContain("useDashboardProjection");
    expect(page).not.toContain("getCurrentSignals");
    expect(page).not.toContain("getSignalHistory");
  });

  it("maps seven signals with plain labels", () => {
    const panel = toSignalsPanelProjection(baseProjection);
    expect(panel.signals).toHaveLength(7);
    expect(panel.signals[0]?.label).toBe(LANGUAGE.signalsPanel.signalLabels.completion_rate);
    expect(panel.condition.label).toBe("Steady Progress");
    expect(panel.condition.allowedActions[0]).toContain("task");
  });

  it("uses identity stage language map", () => {
    const panel = toSignalsPanelProjection(baseProjection);
    expect(panel.identity.label).toBe(LANGUAGE.identity.stages.BUILDING.label);
    expect(panel.identity.description).toContain("rhythm");
  });

  it("freshness badge states by age", () => {
    expect(freshnessFromAgeMs(30_000, false)).toBe("live");
    expect(freshnessFromAgeMs(3 * 60_000, false)).toBe("recent");
    expect(freshnessFromAgeMs(10 * 60_000, false)).toBe("warming");
    expect(freshnessFromAgeMs(20 * 60_000, true)).toBe("updating");
  });

  it("includes explain drawer and no Date.now idempotency", () => {
    expect(readRepo("src/components/signals/ExplainStateDrawer.tsx")).toContain("postExplainState");
    expect(readRepo("src/lib/signals-panel.ts")).toContain("Insufficient Data");
    expect(readRepo("src/components/signals/ConditionPanel.tsx")).toContain("allowedActions");
  });

  it("starter tier hides raw numbers in signal panel", () => {
    expect(readRepo("src/components/signals/SignalMetricsPanel.tsx")).toContain('tier === "ultimate"');
  });
});
