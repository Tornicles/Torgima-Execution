import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "../..");
const readRepo = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("Prompt 6 — Erector frontend additions", () => {
  it("validation layout guard redirects without draft", () => {
    const layout = readRepo("artifacts/torgima/src/components/validation/ValidationLayout.tsx");
    expect(layout).toContain("active-draft");
    expect(layout).toContain("/onboarding/goal");
  });

  it("dashboard shows Execution Context panel with archetype fields", () => {
    const panel = readRepo("artifacts/torgima/src/components/dashboard/ExecutionContextPanel.tsx");
    expect(panel).toContain("Execution Context");
    expect(panel).toContain("Reality Score:");
    expect(panel).toContain("economyBriefingSummary");
    const dash = readRepo("artifacts/api-server/src/services/DashboardService.ts");
    expect(dash).toContain("executionContext");
    expect(dash).toContain("primary_archetype_id");
  });

  it("smoke test indicator on task card", () => {
    const action = readRepo("artifacts/torgima/src/components/dashboard/CurrentActionPanel.tsx");
    expect(action).toContain("erector_first_week_seed");
    expect(action).toContain("Smoke Test — Week 1");
    const orders = readRepo("artifacts/api-server/src/services/OrderService.ts");
    expect(orders).toContain("generationReason");
  });

  it("post-validation redirect to results page", () => {
    const validating = readRepo("artifacts/torgima/src/pages/onboarding/validating.tsx");
    expect(validating).toContain("/validation/");
    expect(validating).toContain("fetchValidationStatus");
  });

  it("legacy validation scores route redirects and upgrade route registered", () => {
    const app = readRepo("artifacts/torgima/src/App.tsx");
    expect(app).toContain("/validation/scores");
    expect(app).toContain("/onboarding/context");
    expect(app).toContain("/onboarding/review");
    expect(app).toContain("/onboarding/validating");
    const validationRoute = readRepo("artifacts/api-server/src/routes/validation.ts");
    expect(validationRoute).toContain("/v1/validation/active-draft");
  });
});
