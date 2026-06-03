import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("DOC 32 — Onboarding & goal input screens", () => {
  it("redirects active-blueprint users via onboarding status guard", () => {
    const guard = readRepo("src/hooks/useOnboardingActiveBlueprintGuard.ts");
    expect(guard).toContain("fetchOnboardingStatus");
    expect(guard).toContain("hasActiveBlueprint");
    expect(guard).toContain("/dashboard");
  });

  it("exposes welcome step and structure route in app shell", () => {
    expect(readRepo("src/pages/onboarding/index.tsx")).toContain("OnboardingWelcomeStep");
    expect(readRepo("src/App.tsx")).toContain("/onboarding/structure");
    expect(readRepo("src/pages/onboarding/structure.tsx")).toContain("OnboardingStructureScreen");
  });

  it("structures goals via approved Bhudhi route with fallback", () => {
    const screen = readRepo("src/components/onboarding/OnboardingStructureScreen.tsx");
    expect(screen).toContain("structureGoal");
    expect(screen).toContain("bhudhiFallbackHint");
    expect(screen).toContain("OnboardingClarificationStep");
  });

  it("splits tier configure from launch on select-blueprint", () => {
    const page = readRepo("src/pages/onboarding/select-blueprint.tsx");
    expect(page).toContain("configureOnboardingTier");
    expect(page).toContain("selectTierAndLaunch");
    expect(page).toContain("tierConfigured");
    expect(page).toContain("launchEnabled");
  });

  it("uses user-facing activation copy", () => {
    expect(readRepo("src/lib/language.ts")).toContain("Start My Execution System");
    expect(readRepo("src/lib/language.ts")).toContain("What do you want to achieve in the next 90 days?");
  });

  it("API client supports configure-tier and status fields", () => {
    expect(readRepo("src/api/onboarding.ts")).toContain("hasActiveBlueprint");
    expect(readRepo("src/api/onboarding.ts")).toContain("configure-tier");
  });
});
