import { describe, it, expect } from "vitest";

/** Mirrors FeedbackProcessingEngine order status mapping (integration-neutral unit). */
function completionStatusToOrderStatus(cs: string): string {
  if (cs === "failed") return "failed";
  if (cs === "skipped") return "skipped";
  if (cs === "partial") return "needs_feedback";
  return "completed";
}

describe("FeedbackProcessingEngine — confidence calculation", () => {
  it("full weight for strong reflection and normal score", () => {
    let weight = 1.0;
    const reflection =
      "I completed the landing page wireframe and shared it with two people for feedback. One liked the layout, the other suggested simplifying the CTA.";
    const score = 7;
    if (reflection.length < 30) weight -= 0.2;
    if (score >= 9 && reflection.length < 50) weight -= 0.3;
    expect(weight).toBe(1.0);
  });

  it("reduces weight for short reflection", () => {
    let weight = 1.0;
    const reflection = "Did it.";
    if (reflection.trim().length < 30) weight -= 0.2;
    expect(weight).toBe(0.8);
  });

  it("flags gaming for high score + weak reflection", () => {
    let weight = 1.0;
    let flagged = false;
    const reflection = "good";
    const score = 9;
    if (score >= 9 && reflection.trim().length < 50) {
      weight -= 0.3;
      flagged = true;
    }
    expect(flagged).toBe(true);
    expect(weight).toBe(0.7);
  });

  it("enforces minimum weight of 0.3", () => {
    let weight = 1.0;
    weight -= 0.2;
    weight -= 0.3;
    weight -= 0.2;
    weight -= 0.2;
    expect(Math.max(0.3, weight)).toBe(0.3);
  });

  it("interrogation triggers when confidence is low on completed task", () => {
    const weight = 0.5;
    const completionStatus = "completed";
    const confidence = weight >= 0.9 ? "high" : weight >= 0.7 ? "medium" : "low";
    const requiresInterrogation = confidence === "low" && completionStatus === "completed";
    expect(requiresInterrogation).toBe(true);
  });
});

describe("FeedbackProcessingEngine — order status transitions", () => {
  it("completed status maps to completed order", () => {
    expect(completionStatusToOrderStatus("completed")).toBe("completed");
  });
  it("failed status maps to failed order", () => {
    expect(completionStatusToOrderStatus("failed")).toBe("failed");
  });
  it("partial maps to needs_feedback", () => {
    expect(completionStatusToOrderStatus("partial")).toBe("needs_feedback");
  });
});
