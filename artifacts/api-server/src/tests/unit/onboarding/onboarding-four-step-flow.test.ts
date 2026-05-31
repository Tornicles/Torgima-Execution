import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Four-step onboarding flow", () => {
  it("registers canonical onboarding routes", () => {
    const app = readRepo("artifacts/torgima/src/App.tsx");
    expect(app).toContain('path="/onboarding"');
    expect(app).toContain('path="/onboarding/context"');
    expect(app).toContain('path="/onboarding/review"');
    expect(app).toContain('path="/onboarding/validating"');
    expect(app).toContain('path="/onboarding/results"');
  });

  it("review step submits goal then validation run", () => {
    const review = readRepo("artifacts/torgima/src/pages/onboarding/review.tsx");
    expect(review).toContain("postOnboardingGoal");
    expect(review).toContain("runOnboardingValidation");
    expect(review).toContain("/onboarding/validating");
  });

  it("exposes v1 validation status and results routes", () => {
    const routes = readRepo("artifacts/api-server/src/routes/validation.ts");
    expect(routes).toContain('router.get("/v1/validations/:id/status"');
    expect(routes).toContain('router.get("/v1/validations/:id/results"');
  });

  it("goal page does not call API on step 1", () => {
    const goal = readRepo("artifacts/torgima/src/pages/onboarding/index.tsx");
    expect(goal).not.toContain("apiFetch");
    expect(goal).not.toContain("postOnboardingGoal");
  });
});
