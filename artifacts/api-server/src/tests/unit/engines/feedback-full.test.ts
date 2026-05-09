import { describe, it, expect } from "vitest";

/** Mirrors Prompt 16 feedback weighting / interrogation heuristic (spec-level). */
function calcWeightAndFlags(score: number, reflection: string, completionStatus: string) {
  let weight = 1.0;
  let flagged = false;
  let gamingReason: string | undefined;

  if (reflection.trim().length < 30) weight -= 0.2;
  if (score >= 9 && reflection.trim().length < 50) {
    weight -= 0.3;
    flagged = true;
    gamingReason = "High score with weak reflection";
  }
  if (score === 10 && reflection.trim().length < 100) weight -= 0.2;
  if (completionStatus === "completed" && score <= 2) weight -= 0.2;
  weight = Math.max(0.3, weight);
  return { weight, flagged, gamingReason };
}

describe("Feedback weighting heuristic — Prompt 16", () => {
  it("full weight for strong reflection + normal score", () => {
    const long =
      "I completed the landing page wireframe and received feedback from two stakeholders. One liked the layout.";
    const { weight, flagged } = calcWeightAndFlags(7, long, "completed");
    expect(weight).toBe(1.0);
    expect(flagged).toBe(false);
  });

  it("reduces weight 0.20 for short reflection", () => {
    const { weight } = calcWeightAndFlags(7, "Done", "completed");
    expect(weight).toBe(0.8);
  });

  it("flags gaming: score 9 + reflection < 50 chars", () => {
    const { flagged, gamingReason } = calcWeightAndFlags(9, "good work", "completed");
    expect(flagged).toBe(true);
    expect(gamingReason).toContain("High score");
  });

  it("minimum weight floor is 0.3", () => {
    const { weight } = calcWeightAndFlags(10, "x", "completed");
    expect(weight).toBeGreaterThanOrEqual(0.3);
  });

  it("interrogation triggers when weight < 0.7 and confidence is low", () => {
    const { weight } = calcWeightAndFlags(9, "ok", "completed");
    const confidence = weight >= 0.9 ? "high" : weight >= 0.7 ? "medium" : "low";
    expect(weight).toBeLessThan(0.7);
    expect(confidence).toBe("low");
  });

  it("failed status never combines with completed interrogation predicate", () => {
    const { weight } = calcWeightAndFlags(0, "x", "failed");
    const confidence = weight >= 0.9 ? "high" : weight >= 0.7 ? "medium" : "low";
    const completionStatus = "failed";
    const requiresInterrogation = confidence === "low" && completionStatus === "completed";
    expect(requiresInterrogation).toBe(false);
  });

  it("completion status mapping intent", () => {
    const map: Record<string, string> = {
      completed: "completed",
      partial: "needs_feedback",
      failed: "failed",
      skipped: "skipped",
    };
    Object.entries(map).forEach(([completion, expected]) => {
      const status =
        completion === "failed"
          ? "failed"
          : completion === "skipped"
            ? "skipped"
            : completion === "partial"
              ? "needs_feedback"
              : "completed";
      expect(status).toBe(expected);
    });
  });
});
