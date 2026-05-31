import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Validation results page wiring", () => {
  it("uses ValidationResultsDashboard with launch flow", () => {
    const page = readRepo("artifacts/torgima/src/pages/validation-results.tsx");
    expect(page).toContain("ValidationResultsDashboard");
    expect(page).toContain("finalizeValidationBlueprint");
    expect(page).toContain("launchValidationBlueprint");
    expect(page).not.toContain("AlignedValidationResults");
  });

  it("dashboard renders Launch This Direction button", () => {
    const dashboard = readRepo("artifacts/torgima/src/components/validation/ValidationResultsDashboard.tsx");
    expect(dashboard).toContain("Launch This Direction");
  });

  it("validation results route uses onboarding layout without app sidebar", () => {
    const app = readRepo("artifacts/torgima/src/App.tsx");
    expect(app).toContain("withOnboardingLayout(ProtectedValidationResults)");
    expect(app).not.toContain("withAppLayout(ProtectedValidationResults)");
  });

  it("dashboard model exposes goal purpose timeframe direction", () => {
    const model = readRepo("artifacts/torgima/src/components/validation/validation-results-dashboard-model.ts");
    expect(model).toContain("timeframeLabel");
    expect(model).toContain("selectedDirectionLabel");
    expect(model).toContain("rawGoal");
    expect(model).toContain("purpose");
  });
});

describe("Erector validation persistence", () => {
  it("orchestration saves timeframe on insert", () => {
    const orch = readRepo("artifacts/api-server/src/engines/erector/ErectorOrchestrationService.ts");
    expect(orch).toContain("timeframe: timeframeFields.timeframe");
    expect(orch).toContain("timeframe_days: timeframeFields.timeframe_days");
  });

  it("onboarding goal saves timeframe_days on blueprint", () => {
    const onboarding = readRepo("artifacts/api-server/src/routes/onboarding.ts");
    expect(onboarding).toContain("timeframe_days: input.timeframeDays");
  });
});
