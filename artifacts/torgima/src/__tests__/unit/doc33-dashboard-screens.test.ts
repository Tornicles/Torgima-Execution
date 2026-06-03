import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("DOC 33 — Dashboard control panel", () => {
  it("routes dashboard through six shell states", () => {
    const page = readRepo("src/pages/dashboard.tsx");
    expect(page).toContain("DashboardSkeleton");
    expect(page).toContain("HealthLockState");
    expect(page).toContain("PendingSyncState");
    expect(page).toContain("/onboarding");
    expect(page).toContain("DashboardControlPanel");
  });

  it("uses allowedActions in CurrentActionPanel", () => {
    const panel = readRepo("src/components/dashboard/CurrentActionPanel.tsx");
    expect(panel).toContain("ActionButtons");
    expect(panel).toContain("allowedActions");
    expect(panel).toContain("NoTaskState");
  });

  it("defines control projection types", () => {
    expect(readRepo("src/types/dashboard.ts")).toContain("OrderSummary");
    expect(readRepo("src/lib/dashboard-control.ts")).toContain("toDashboardControlProjection");
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
});
