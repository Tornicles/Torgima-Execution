/**
 * DOC 37 — invalid onboarding, task, and feedback payloads.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { assertFeedbackPayloadWithinLimit, FEEDBACK_PAYLOAD_MAX_BYTES } from "../../../lib/feedback-payload-limit.js";
import { TorgimaError } from "../../../lib/errors.js";

const feedbackBodySchema = z.object({
  completionStatus: z.enum(["completed", "partial", "failed", "skipped"]),
  score: z.number().int().min(0).max(10),
  reflection: z.string().min(10).max(5000),
  idempotencyKey: z.string().min(1),
});

describe("DOC 37 — errors.validation", () => {
  it("rejects feedback without completion status", () => {
    const parsed = feedbackBodySchema.safeParse({
      score: 5,
      reflection: "too short",
      idempotencyKey: "k1",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects reflection shorter than 10 chars", () => {
    const parsed = feedbackBodySchema.safeParse({
      completionStatus: "completed",
      score: 5,
      reflection: "short",
      idempotencyKey: "k1",
    });
    expect(parsed.success).toBe(false);
  });

  it("throws PAYLOAD_TOO_LARGE before engine when body exceeds 10KB", () => {
    const huge = "x".repeat(FEEDBACK_PAYLOAD_MAX_BYTES + 1);
    const req = {
      headers: {},
      body: {
        completionStatus: "completed",
        score: 8,
        reflection: huge,
        idempotencyKey: "k-big",
      },
    } as import("express").Request;
    expect(() => assertFeedbackPayloadWithinLimit(req)).toThrow(TorgimaError);
    try {
      assertFeedbackPayloadWithinLimit(req);
    } catch (e) {
      expect((e as TorgimaError).code).toBe("PAYLOAD_TOO_LARGE");
    }
  });

  it("activateBlueprint missing tier throws ACTIVATION_FAILED not generic 500", async () => {
    const { assertSelectionComplete } = await import(
      "../../../engines/blueprint/BlueprintRuleEngine.js"
    );
    try {
      assertSelectionComplete({
        tier: null,
        mode: "individual",
        selectionConfirmedAt: new Date(),
      });
      expect.fail("expected ACTIVATION_FAILED");
    } catch (e) {
      expect(e).toMatchObject({ code: "ACTIVATION_FAILED" });
    }
  });
});
