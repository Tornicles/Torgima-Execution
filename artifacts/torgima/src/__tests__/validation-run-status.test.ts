import { describe, expect, it } from "vitest";
import {
  VALIDATION_PIPELINE_STAGES,
  validationPipelineLabel,
  validationStatusStep,
} from "@/lib/validation-run-status";

describe("validation-run-status", () => {
  it("maps nine pipeline phases including competitor research", () => {
    expect(VALIDATION_PIPELINE_STAGES).toHaveLength(9);
    expect(validationStatusStep("researching_competitor_pioneer")).toBe(3);
    expect(validationStatusStep("generating_explanations")).toBe(7);
    expect(validationStatusStep("complete")).toBe(8);
  });

  it("returns human labels for API status values", () => {
    expect(validationPipelineLabel("running_analysis")).toMatch(/Analysing/i);
    expect(validationPipelineLabel("generating_explanations")).toMatch(/Writing/i);
  });
});
