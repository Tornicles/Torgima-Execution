import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRE_VALIDATION_DRAFT,
  buildSummaryOverviewBullets,
  pacingFullLabel,
} from "@/lib/pre-validation-draft";

describe("pre-validation draft defaults", () => {
  it("limits goal and purpose lengths in UI contract", () => {
    expect(DEFAULT_PRE_VALIDATION_DRAFT.step).toBe(1);
    expect(DEFAULT_PRE_VALIDATION_DRAFT.goal).toBe("");
    expect(DEFAULT_PRE_VALIDATION_DRAFT.purpose).toBe("");
  });

  it("formats pacing with intensity sublabel", () => {
    expect(pacingFullLabel("FOCUSED")).toBe("Focused (Balanced)");
  });

  it("builds summary overview from draft fields", () => {
    const bullets = buildSummaryOverviewBullets({
      ...DEFAULT_PRE_VALIDATION_DRAFT,
      quickContext: {
        ...DEFAULT_PRE_VALIDATION_DRAFT.quickContext,
        domain: "SaaS",
        targetAudience: "Startups",
      },
      currentStage: "Building MVP",
      resourcesAvailable: "Moderate budget",
      startDate: "2025-05-25",
      endDate: "2026-05-25",
      pacing: "FOCUSED",
      weeklyCommitment: "HIGH",
    });
    expect(bullets).toHaveLength(4);
    expect(bullets[0]).toContain("SaaS");
    expect(bullets[0]).toContain("Startups");
  });
});
