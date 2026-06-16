import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  mutationsDisabledForState,
  resolveDashboardSystemState,
} from "@/lib/dashboard-states";
import { getConditionLabel } from "@/lib/language-map";
import type { DashboardControlProjection } from "@/types/dashboard";

const root = resolve(import.meta.dirname, "../../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

const baseControl = (): DashboardControlProjection => ({
  stateVersion: 1,
  blueprintId: "bp-1",
  condition: "stability",
  conditionLabel: "On Track",
  conditionPanel: {
    conditionKey: "stability",
    label: "On Track",
    explanation: "You are executing consistently.",
    restrictions: [],
  },
  currentAction: {
    orderId: "ord-1",
    title: "Ship landing page",
    instruction: "Publish the page.",
    difficulty: "moderate",
    proofRequired: false,
    allowedActions: ["start"],
  },
  pendingSync: false,
  locked: false,
  signalSummary: { completionRate: 0.78, weightedScore: 7.2, trend: "up" },
});

describe("DOC 33 — Dashboard control panel", () => {
  it("routes dashboard through six shell states", () => {
    const page = readRepo("src/pages/dashboard.tsx");
    expect(page).toContain("DashboardSkeleton");
    expect(page).toContain("HealthLockState");
    expect(page).toContain("PendingSyncState");
    expect(page).toContain("/onboarding");
    expect(page).toContain("DashboardControlPanel");
  });

  it("uses two-column layout and projection panels", () => {
    const panel = readRepo("src/components/dashboard/DashboardControlPanel.tsx");
    expect(panel).toContain("lg:grid-cols");
    expect(panel).toContain("ConditionPanel");
    expect(panel).toContain("CurrentActionPanel");
    expect(panel).toContain("FeedbackPendingState");
    expect(panel).toContain("DependencyPanel");
    expect(panel).toContain("OutcomeSummary");
    expect(panel).toContain("startOrder");
  });

  it("uses allowedActions and customer task fields in CurrentActionPanel", () => {
    const panel = readRepo("src/components/dashboard/CurrentActionPanel.tsx");
    expect(panel).toContain("ActionButtons");
    expect(panel).toContain("allowedActions");
    expect(panel).toContain("whyItMatters");
    expect(panel).toContain("definitionOfDone");
    expect(panel).toContain("NoTaskState");
  });

  it("ConditionPanel uses language-map labels", () => {
    const condition = readRepo("src/components/dashboard/ConditionPanel.tsx");
    expect(condition).toContain("SIGNAL_LABELS");
    expect(condition).toContain("getConditionLabel");
    expect(getConditionLabel("danger")).toBe("At Risk");
  });

  it("defines control projection types and eight system states", () => {
    expect(readRepo("src/types/dashboard.ts")).toContain("OrderSummary");
    expect(readRepo("src/lib/dashboard-control.ts")).toContain("toDashboardControlProjection");
    expect(readRepo("src/lib/dashboard-states.ts")).toContain("resolveDashboardSystemState");
  });

  it("reduces motion during danger condition", () => {
    expect(readRepo("src/lib/dashboard-control.ts")).toContain("shouldReduceMotion");
    expect(readRepo("src/components/dashboard/DashboardShell.tsx")).toContain("reduce-motion");
  });

  it("API derives order allowed actions", () => {
    expect(
      readFileSync(resolve(root, "../api-server/src/lib/dashboardOrderActions.ts"), "utf8"),
    ).toContain("deriveOrderAllowedActions");
  });

  it("polls pending sync every 5 seconds", () => {
    expect(readRepo("src/hooks/useDashboardProjection.ts")).toContain("5_000");
  });

  it("disables mutations when locked or stale", () => {
    expect(mutationsDisabledForState("SYSTEM_LOCKED")).toBe(true);
    expect(mutationsDisabledForState("STALE_STATE")).toBe(true);
    expect(mutationsDisabledForState("NORMAL_EXECUTION")).toBe(false);
  });
});

describe("dashboard", () => {
  it("resolves system states from projection", () => {
    const control = baseControl();
    expect(
      resolveDashboardSystemState({ uiState: "READY", control }),
    ).toBe("NORMAL_EXECUTION");
    expect(
      resolveDashboardSystemState({ uiState: "LOCKED", control: { ...control, locked: true } }),
    ).toBe("SYSTEM_LOCKED");
    expect(
      resolveDashboardSystemState({
        uiState: "AWAITING_FEEDBACK",
        control: { ...control, pendingSync: true },
      }),
    ).toBe("FEEDBACK_PENDING");
    expect(
      resolveDashboardSystemState({
        uiState: "READY",
        control: { ...control, currentAction: null },
      }),
    ).toBe("NO_TASK");
  });
});
