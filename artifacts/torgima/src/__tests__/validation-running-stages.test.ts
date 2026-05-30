import { describe, expect, it } from "vitest";
import { VALIDATION_RUNNING_STAGES } from "@/components/erector/ValidationRunningDashboard";

describe("ValidationRunningDashboard stages", () => {
  it("defines seven cycling validation stages", () => {
    expect(VALIDATION_RUNNING_STAGES).toHaveLength(7);
    expect(VALIDATION_RUNNING_STAGES[0]).toMatch(/goal and purpose/i);
    expect(VALIDATION_RUNNING_STAGES.at(-1)).toMatch(/validation results/i);
  });
});
