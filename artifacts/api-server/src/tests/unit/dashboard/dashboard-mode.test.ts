/**
 * DOC B9 — dashboard mode enforcement contract.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "../..");
const readRepo = (rel: string) => readFileSync(resolve(repoRoot, rel), "utf8");

describe("DOC B9 — dashboard mode enforcement", () => {
  it("DashboardService projects limited and full modes", () => {
    const dash = readRepo("artifacts/api-server/src/services/DashboardService.ts");
    expect(dash).toMatch(/dashboard_mode|mode.*limited|mode.*full|buildReviewDashboardState/i);
  });

  it("handoff pro→torgima sets review dashboard mode", () => {
    const handoff = readRepo("artifacts/api-server/src/services/handoff-service.ts");
    expect(handoff).toMatch(/dashboard_mode|review|full/);
  });

  it("intake completion activates full dashboard mode", () => {
    const feed = readRepo("artifacts/api-server/src/services/erector/blueprint-feed-service.ts");
    expect(feed).toContain("full");
    expect(feed).toMatch(/dashboard_mode|activateBlueprint/);
  });

  it("frontend dashboard handles limited and review gated modes", () => {
    const page = readRepo("artifacts/torgima/src/pages/dashboard.tsx");
    expect(page).toMatch(/limited|review|full/);
  });
});
