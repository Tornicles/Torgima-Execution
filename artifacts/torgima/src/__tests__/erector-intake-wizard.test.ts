import { describe, expect, it } from "vitest";
import { INTAKE_STEP_LABELS } from "@/lib/erector-intake-api";

describe("Erector intake wizard (B4b)", () => {
  it("uses customer-language step names for all sections", () => {
    expect(INTAKE_STEP_LABELS).toEqual([
      "Project Identity",
      "Target User / Customer",
      "Market / Competition",
      "Offer / Product / Revenue",
      "Resources / Capability",
      "Timeline / Commitment",
      "Risks / Constraints / Dependencies",
      "Strategy / Direction Preference",
      "Proof / Evidence (Optional)",
    ]);
  });
});
