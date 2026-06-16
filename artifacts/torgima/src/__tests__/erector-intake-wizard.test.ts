import { describe, expect, it } from "vitest";
import { INTAKE_STEP_LABELS } from "@/lib/erector-intake-api";

describe("Erector intake wizard (B4b)", () => {
  it("uses customer-language step names for all 8 sections", () => {
    expect(INTAKE_STEP_LABELS).toEqual([
      "Your Project",
      "Your Customer",
      "Your Market",
      "Your Revenue",
      "Your Resources",
      "Your Timeline",
      "Your Constraints",
      "Your Success Definition",
    ]);
  });
});
