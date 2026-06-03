import { describe, it, expect } from "vitest";
import {
  runAntiGamingChecks,
  classifyVerdict,
  type FeedbackSubmissionPayload,
} from "../../../engines/feedback/submitFeedbackPhase1.js";

const basePayload = (overrides: Partial<FeedbackSubmissionPayload> = {}): FeedbackSubmissionPayload => ({
  orderId: "00000000-0000-4000-8000-000000000001",
  completion: "COMPLETED",
  clientStateVersion: 1,
  idempotencyKey: "test-key-1",
  effortScore: 3,
  frictionScore: 3,
  confidenceScore: 3,
  ...overrides,
});

const baseOrder = {
  proof_required: false,
  time_estimate_minutes: 60,
  difficulty: "medium",
} as unknown as Parameters<typeof runAntiGamingChecks>[0]["order"];

describe("FeedbackProcessingEngine — anti-gaming", () => {
  it("rejects score inflation (high effort, low friction, short duration)", () => {
    const payload = basePayload({
      effortScore: 5,
      frictionScore: 1,
      durationMinutes: 5,
      userNotes: "ok",
    });
    const result = runAntiGamingChecks({ payload, order: baseOrder, recentFeedbacks: [] });
    expect(result.verdict).toBe("REJECTED");
    expect(result.reason).toBe("score_inflation");
  });

  it("flags instant completion on long tasks", () => {
    const payload = basePayload({ durationMinutes: 1 });
    const order = { ...baseOrder, time_estimate_minutes: 120 };
    const result = runAntiGamingChecks({ payload, order, recentFeedbacks: [] });
    expect(result.verdict).toBe("HELD_FOR_REVIEW");
    expect(result.reason).toBe("instant_completion");
  });

  it("requires proof when order.proof_required", () => {
    const payload = basePayload({ completion: "COMPLETED" });
    const order = { ...baseOrder, proof_required: true };
    const result = runAntiGamingChecks({ payload, order, recentFeedbacks: [] });
    expect(result.verdict).toBe("CLARIFICATION_REQUIRED");
  });
});

describe("FeedbackProcessingEngine — verdict classification", () => {
  it("accepts completed with proof when required", () => {
    const payload = basePayload({ completion: "COMPLETED", proofText: "Done" });
    const order = { ...baseOrder, proof_required: true };
    const verdict = classifyVerdict({
      payload,
      order,
      antiGaming: null,
      proofPresent: true,
    });
    expect(verdict).toBe("ACCEPTED");
  });

  it("maps PARTIAL completion to PARTIAL_ACCEPTED", () => {
    const verdict = classifyVerdict({
      payload: basePayload({ completion: "PARTIAL" }),
      order: baseOrder,
      antiGaming: null,
      proofPresent: false,
    });
    expect(verdict).toBe("PARTIAL_ACCEPTED");
  });

  it("maps FAILED to FAILED_CONFIRMED", () => {
    const verdict = classifyVerdict({
      payload: basePayload({ completion: "FAILED" }),
      order: baseOrder,
      antiGaming: null,
      proofPresent: false,
    });
    expect(verdict).toBe("FAILED_CONFIRMED");
  });
});
