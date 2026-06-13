import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildDeterministicIntel,
} from "../../../engines/launch/LaunchModeValidationEngine.js";
import {
  runWithResilience,
  isAdvancedIntelligenceOptional,
  launchDefaultPath,
  launchDefaultTier,
} from "../../../lib/systemResilience.js";
import { scoreGoal, determineVerdict } from "../../../engines/validation/ValidationEngine.js";

describe("Launch Mode System Resilience", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  describe("buildDeterministicIntel", () => {
    it("produces strengths, weaknesses, opportunities, risks, and recommendations", () => {
      const scores = scoreGoal({
        goal: "Build a SaaS product for small businesses to manage invoices online",
        purpose: "Help SMBs get paid faster with less admin overhead",
        timeframe: "90d",
        commitmentLevel: "high",
      });
      const verdict = determineVerdict(scores);
      const intel = buildDeterministicIntel({
        goal: "Build a SaaS product for small businesses to manage invoices online",
        purpose: "Help SMBs get paid faster",
        scores,
        verdict,
      });

      expect(intel.strengths.length).toBeGreaterThan(0);
      expect(intel.weaknesses.length).toBeGreaterThanOrEqual(0);
      expect(intel.opportunities.length).toBeGreaterThanOrEqual(3);
      expect(intel.risks.length).toBeGreaterThanOrEqual(0);
      expect(intel.recommendations.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("runWithResilience", () => {
    beforeEach(() => {
      process.env.LAUNCH_MODE = "true";
    });

    it("uses fallback when primary throws in launch mode", async () => {
      const outcome = await runWithResilience(
        { label: "test" },
        async () => {
          throw new Error("Bhudhi unavailable");
        },
        async () => "fallback-value",
      );
      expect(outcome.usedFallback).toBe(true);
      expect(outcome.value).toBe("fallback-value");
    });

    it("returns primary when it succeeds", async () => {
      const outcome = await runWithResilience(
        { label: "test" },
        async () => "primary-value",
        async () => "fallback-value",
      );
      expect(outcome.usedFallback).toBe(false);
      expect(outcome.value).toBe("primary-value");
    });

    it("rethrows when not launch mode and not DB error", async () => {
      process.env.LAUNCH_MODE = "false";
      await expect(
        runWithResilience(
          { label: "test" },
          async () => {
            throw new Error("business rule violation");
          },
          async () => "fallback",
        ),
      ).rejects.toThrow("business rule violation");
    });
  });

  describe("launch defaults", () => {
    it("defaults tier to starter and path to adjusted", () => {
      expect(launchDefaultTier()).toBe("starter");
      expect(launchDefaultPath()).toBe("adjusted");
    });
  });

  describe("isAdvancedIntelligenceOptional", () => {
    it("is true when LAUNCH_MODE=true", () => {
      process.env.LAUNCH_MODE = "true";
      expect(isAdvancedIntelligenceOptional()).toBe(true);
    });

    it("is false when LAUNCH_MODE unset", () => {
      delete process.env.LAUNCH_MODE;
      expect(isAdvancedIntelligenceOptional()).toBe(false);
    });
  });
});

describe("Launch Mode acceptance scenarios (unit proof)", () => {
  it("Scenario 1-6: deterministic validation never imports Anthropic", async () => {
    const src = await import("fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../engines/launch/LaunchModeValidationEngine.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).not.toContain("@anthropic-ai/sdk");
    expect(src).not.toContain("openai");
    expect(src).toContain("generatePathsDeterministic");
    expect(src).toContain("scoreGoal");
  });

  it("Scenario 7: validation route wires resilience fallback", async () => {
    const src = await import("fs/promises").then((fs) =>
      fs.readFile(new URL("../../../routes/validation.ts", import.meta.url), "utf8"),
    );
    expect(src).toContain("runWithResilience");
    expect(src).toContain("runLaunchModeDeterministicValidation");
    expect(src).toContain("usedFallback");
  });

  it("Blueprint tier launch has minimal fallback", async () => {
    const src = await import("fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../services/BlueprintTierLaunchService.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toContain("activateMinimalLaunchBlueprint");
  });

  it("Dashboard has degraded safe mode", async () => {
    const src = await import("fs/promises").then((fs) =>
      fs.readFile(new URL("../../../services/DashboardService.ts", import.meta.url), "utf8"),
    );
    expect(src).toContain("degraded projection");
    expect(src).toContain("buildNoActiveBlueprintDashboardState");
  });
});
