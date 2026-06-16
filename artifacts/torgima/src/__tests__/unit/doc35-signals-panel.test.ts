import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  freshnessFromAgeMs,
  formatRelativeTime,
  toSignalsPanelProjection,
} from "@/lib/signals-panel";
import { LANGUAGE } from "@/lib/language";
import { getIdentityStageLabel, IDENTITY_STAGE_LABELS } from "@/lib/language-map";
import type { DashboardProjection } from "@/lib/dashboard-types";

const root = resolve(import.meta.dirname, "../../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

const baseProjection = {
  hasActiveBlueprint: true,
  stateVersion: 1,
  conditionLabel: "On Track",
  signal_breakdown: {
    completion_rate: 0.75,
    weighted_score: 7.2,
    momentum: 4,
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
  signals: { velocity: 72, consistency: 75, streak: 4, computedAt: new Date().toISOString() },
  activeCondition: {
    condition: "stability",
    allowed_actions: ["task_execution", "feedback_submission"],
    blocked_actions: ["scaling_tasks"],
  },
  conditionDetail: { condition: "stability", durationDays: 6, recoveryRequired: false, escalationLevel: 0 },
  identity: { stage: "BUILDING", progressToNext: 42, nextStageLabel: "Finding Your Rhythm" },
  tasksCompletedThisWeek: 12,
  streakDays: 5,
  blueprintTier: "growth",
} as unknown as DashboardProjection;

describe("DOC 35 — Signal, condition & identity panel", () => {
  it("signals page uses dashboard projection only", () => {
    const page = readRepo("src/pages/signals.tsx");
    expect(page).toContain("useDashboardProjection");
    expect(page).not.toContain("getCurrentSignals");
    expect(page).not.toContain("getSignalHistory");
  });

  it("SignalPanel renders health score and four breakdown metrics", () => {
    const panel = toSignalsPanelProjection(baseProjection);
    expect(panel.signalSummary.completionRatePct).toBe(75);
    expect(panel.signalSummary.workQuality).toBe("7.2");
    expect(panel.signalSummary.healthScore).toBeGreaterThan(0);
    const signalPanel = readRepo("src/components/signals/SignalPanel.tsx");
    expect(signalPanel).toContain("Health Score");
    expect(signalPanel).toContain("Completion Rate");
    expect(signalPanel).toContain("Work Quality");
  });

  it("uses identity stage language map — never raw enum in label", () => {
    const panel = toSignalsPanelProjection(baseProjection);
    expect(panel.identity.label).toBe(getIdentityStageLabel("BUILDING"));
    expect(panel.identity.label).toBe(IDENTITY_STAGE_LABELS.BUILDING);
    expect(panel.identity.label).not.toBe("BUILDING");
    expect(readRepo("src/components/signals/IdentityPanel.tsx")).toContain("progressToNext");
  });

  it("freshness badge marks stale data after six hours", () => {
    expect(freshnessFromAgeMs(30_000, false)).toBe("live");
    expect(freshnessFromAgeMs(3 * 60_000, false)).toBe("recent");
    expect(freshnessFromAgeMs(2 * 60 * 60_000, false)).toBe("warming");
    expect(freshnessFromAgeMs(8 * 60 * 60_000, false)).toBe("stale");
    expect(freshnessFromAgeMs(30 * 60 * 60_000, false)).toBe("outdated");
    const staleProjection = {
      ...baseProjection,
      signal_breakdown: {
        ...baseProjection.signal_breakdown!,
        generated_at: new Date(Date.now() - 8 * 60 * 60_000).toISOString(),
      },
    } as DashboardProjection;
    const panel = toSignalsPanelProjection(staleProjection);
    expect(panel.signalSummary.freshness).toBe("stale");
    expect(panel.signalSummary.freshnessLabel).toContain("outdated");
  });

  it("explain drawer supports focus trap and ESC close", () => {
    const drawer = readRepo("src/components/signals/ExplainStateDrawer.tsx");
    expect(drawer).toContain("postExplainState");
    expect(drawer).toContain('e.key === "Escape"');
    expect(drawer).toContain("aria-modal");
    expect(readRepo("src/components/signals/ConditionPanel.tsx")).toContain(
      LANGUAGE.signalsPanel.explain,
    );
  });

  it("condition panel shows duration and allowed activities", () => {
    const panel = toSignalsPanelProjection(baseProjection);
    expect(panel.condition.durationDays).toBe(6);
    expect(panel.condition.allowedActions.length).toBeGreaterThan(0);
    expect(panel.condition.durationLabel).toContain("6 days");
  });

  it("maps seven extended signals for detail panel", () => {
    const panel = toSignalsPanelProjection(baseProjection);
    expect(panel.signals).toHaveLength(7);
    expect(panel.signals[0]?.label).toBe(LANGUAGE.signalsPanel.signalLabels.completion_rate);
  });

  it("formatRelativeTime produces human-readable freshness", () => {
    expect(formatRelativeTime(new Date().toISOString())).toBe("just now");
  });
});
