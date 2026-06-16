import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CUSTOMER_VERDICT_LABELS,
  PATH_DIRECTION_LABELS,
  LAUNCH_WHAT_HAPPENS_NEXT,
  resolveLimitedDashboardVariant,
  estimateIntakeMinutesRemaining,
} from "@/lib/onboarding-doc32";

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
    expect(readRepo("src/lib/language.ts")).toContain("Launch My Project");
    expect(readRepo("src/lib/language.ts")).toContain("What do you want to achieve in the next 90 days?");
  });

  it("API client supports configure-tier and intake status fields", () => {
    expect(readRepo("src/api/onboarding.ts")).toContain("hasActiveBlueprint");
    expect(readRepo("src/api/onboarding.ts")).toContain("hasIntake");
    expect(readRepo("src/api/onboarding.ts")).toContain("intakeInProgress");
    expect(readRepo("src/api/onboarding.ts")).toContain("configure-tier");
  });

  it("renders LIMITED dashboard variants A/B/C", () => {
    const dash = readRepo("src/components/dashboard/LimitedDashboard/LimitedDashboard.tsx");
    expect(dash).toContain("VariantA_PostFreeValidation");
    expect(dash).toContain("VariantB_DirectSignup");
    expect(dash).toContain("VariantC_IntakeInProgress");
    expect(readRepo("src/pages/dashboard.tsx")).toContain("LimitedModeDashboard");
  });

  it("8-section intake wizard auto-saves with visible save state", () => {
    const wizard = readRepo("src/components/erector/IntakeWizard.tsx");
    expect(wizard).toContain("saveIntakeSection");
    expect(wizard).toContain("Saved just now");
    expect(wizard).toContain("minutes remaining");
    expect(readRepo("src/components/onboarding/IntakeWizard.tsx")).toContain("IntakeWizard");
  });

  it("validation paths use customer language and block current on pivot", () => {
    const paths = readRepo("src/components/validation/PathPanels.tsx");
    expect(paths).toContain("PATH_DIRECTION_LABELS");
    expect(paths).toContain("pivotBlocksCurrent");
    expect(paths).toContain("disabled");
    expect(CUSTOMER_VERDICT_LABELS.pivot).toBe("Change Direction");
    expect(PATH_DIRECTION_LABELS.current).toBe("Current Direction");
  });

  it("blueprint launch confirmation shows what happens next", () => {
    const launch = readRepo("src/components/onboarding/BlueprintLaunchConfirmation.tsx");
    expect(launch).toContain("BlueprintLaunchConfirmation");
    expect(launch).toContain("What happens next");
    expect(LAUNCH_WHAT_HAPPENS_NEXT[0]).toContain("first specific task");
    expect(readRepo("src/components/pre-validation/BlueprintLaunchInputScreen.tsx")).toContain(
      "BlueprintLaunchConfirmation",
    );
  });
});

describe("onboarding-goal-input", () => {
  it("resolves limited dashboard variant from user state", () => {
    expect(resolveLimitedDashboardVariant({ validationSummary: "Score: 72" })).toBe(
      "post_free_validation",
    );
    expect(resolveLimitedDashboardVariant({ intakeInProgress: true })).toBe("intake_in_progress");
    expect(resolveLimitedDashboardVariant({})).toBe("direct_signup");
  });

  it("estimates intake time from sections completed", () => {
    expect(estimateIntakeMinutesRemaining(0)).toBe(16);
    expect(estimateIntakeMinutesRemaining(6)).toBe(4);
  });
});
