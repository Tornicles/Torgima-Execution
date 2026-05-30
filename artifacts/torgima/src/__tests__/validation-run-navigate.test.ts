import { describe, expect, it } from "vitest";
import { validationRunNavigatePath } from "@/lib/validation-run";

describe("validationRunNavigatePath", () => {
  it("routes to validation results after success, not dashboard or onboarding", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(validationRunNavigatePath(id, `/onboarding?id=${id}`)).toBe(`/validation/${id}/results`);
    expect(validationRunNavigatePath(id, null)).toBe(`/validation/${id}/results`);
    expect(validationRunNavigatePath(id, `/validation/${id}/results`)).toBe(`/validation/${id}/results`);
  });
});
