import { describe, expect, it } from "vitest";
import { validateProof } from "../../../engines/execution-loop/feedback/ProofValidator.js";
import { detectGaming } from "../../../engines/execution-loop/feedback/GamingDetector.js";
import {
  buildInterrogationDecision,
  selectInterrogationQuestion,
} from "../../../engines/execution-loop/feedback/InterrogationEngine.js";
import { classifyBlocker } from "../../../engines/execution-loop/feedback/BlockerClassifier.js";
import { applyLateFeedbackPenalty } from "../../../engines/execution-loop/feedback/lateFeedback.js";
import {
  determineFeedbackVerdict,
  confidenceLabel,
} from "../../../engines/execution-loop/feedback/FeedbackVerdictEngine.js";
import {
  classifyVerdict,
  runAntiGamingChecks,
  type FeedbackSubmissionPayload,
} from "../../../engines/feedback/submitFeedbackPhase1.js";
import { EVENT_TYPES } from "../../../services/EventService.js";

const baseOrder = {
  proof_required: false,
  time_estimate_minutes: 60,
  difficulty: "medium",
  title: "Publish landing page",
  started_at: new Date(Date.now() - 36 * 3_600_000),
} as never;

const basePayload = (overrides: Partial<FeedbackSubmissionPayload> = {}): FeedbackSubmissionPayload => ({
  orderId: "00000000-0000-4000-8000-000000000001",
  completion: "COMPLETED",
  clientStateVersion: 1,
  idempotencyKey: "test-key-doc10",
  effortScore: 3,
  frictionScore: 3,
  confidenceScore: 3,
  durationMinutes: 30,
  userNotes: "Completed with meaningful reflection on what was produced and learned.",
  ...overrides,
});

describe("feedback-processing — DOC 10 interrogation", () => {
  it("high score weak reflection triggers interrogation", () => {
    const payload = basePayload({ effortScore: 5, userNotes: "Done" });
    const gaming = detectGaming({
      payload,
      order: baseOrder,
      recentFeedbacks: [],
      reflection: "Done",
    });
    const interrogation = buildInterrogationDecision({
      confidence_multiplier: gaming.confidence_multiplier,
      flags: gaming.flags,
      trigger_interrogation: gaming.trigger_interrogation,
      taskTitle: "Publish landing page",
    });
    const verdict = determineFeedbackVerdict({
      payload,
      order: baseOrder,
      proofPresent: false,
      proofValidation: { valid: true, proof_class: "NONE" },
      gaming,
      confidence_multiplier: gaming.confidence_multiplier,
      interrogation,
    });
    expect(verdict).toBe("CLARIFICATION_REQUIRED");
    expect(interrogation.question).toContain("brief");
  });
});

describe("feedback-processing — proof validation", () => {
  it("accepts valid text proof", () => {
    const proofText =
      "I published the landing page with hero copy, pricing section, and signup form wired to the CRM integration.";
    const result = validateProof({
      payload: basePayload({
        proofType: "TEXT",
        proofText,
      }),
      order: Object.assign({}, baseOrder, { proof_required: true, expected_output: "landing page" }) as never,
    });
    expect(result.valid).toBe(true);
    expect(confidenceLabel(0.75)).toBe("medium");
  });
});

describe("feedback-processing — blocker classification", () => {
  it("classifies external wait blockers", () => {
    const result = classifyBlocker("waiting for client to send files");
    expect(result.blocker_category).toBe("EXTERNAL_WAIT");
    expect(result.resolution_event).toBe(EVENT_TYPES.DEPENDENCY_RESOLUTION_REQUESTED);
  });
});

describe("feedback-processing — gaming patterns", () => {
  it("detects repeated perfect score pattern", () => {
    const recent = Array.from({ length: 5 }).map((_, i) => ({
      score: 10,
      reflection: "ok done",
      id: `f-${i}`,
    })) as never[];
    const gaming = detectGaming({
      payload: basePayload({ effortScore: 5, userNotes: "perfect again" }),
      order: baseOrder,
      recentFeedbacks: recent,
      reflection: "perfect again",
    });
    expect(gaming.flags).toContain("REPEATED_PERFECT_SCORE_PATTERN");
    expect(gaming.trigger_hold_for_review).toBe(true);
  });
});

describe("feedback-processing — late feedback", () => {
  it("applies 15% penalty after 24 hours", () => {
    const startedAt = new Date(Date.now() - 36 * 3_600_000);
    const late = applyLateFeedbackPenalty(1, startedAt);
    expect(late.late_penalty_applied).toBe(true);
    expect(late.confidence_multiplier).toBeCloseTo(0.85, 2);
  });
});

describe("feedback-processing — legacy compatibility", () => {
  it("preserves score inflation rejection", () => {
    const payload = basePayload({
      effortScore: 5,
      frictionScore: 1,
      durationMinutes: 5,
      userNotes: "ok",
    });
    const result = runAntiGamingChecks({ payload, order: baseOrder, recentFeedbacks: [] });
    expect(result.verdict).toBe("REJECTED");
  });

  it("preserves instant completion hold", () => {
    const payload = basePayload({ durationMinutes: 1 });
    const order = Object.assign({}, baseOrder, { time_estimate_minutes: 120 });
    const result = runAntiGamingChecks({ payload, order, recentFeedbacks: [] });
    expect(result.verdict).toBe("HELD_FOR_REVIEW");
  });

  it("maps partial completion via classifyVerdict", () => {
    expect(
      classifyVerdict({
        payload: basePayload({ completion: "PARTIAL" }),
        order: baseOrder,
        antiGaming: null,
        proofPresent: false,
      }),
    ).toBe("PARTIAL_ACCEPTED");
  });
});

describe("feedback-processing — interrogation questions", () => {
  it("selects flag-specific question copy", () => {
    const question = selectInterrogationQuestion({
      flags: ["FAILED_BUT_HIGH_SCORE"],
    });
    expect(question).toContain("failed but gave a high score");
  });
});
