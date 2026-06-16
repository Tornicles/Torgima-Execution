import { describe, expect, it } from "vitest";
import { classifyEvidence } from "../../../services/erector/evidence/EvidenceClassifier.js";
import { scoreEvidenceStrength } from "../../../services/erector/evidence/EvidenceStrengthScorer.js";

describe("evidence-ledger classifier and scorer", () => {
  it("classifies payment_signal as PAYMENT_PROOF with HIGH strength and no integrity flags", () => {
    const evidenceClass = classifyEvidence("payment_signal", {
      amount: 49.99,
      currency: "USD",
      type: "subscription_payment",
    });
    expect(evidenceClass).toBe("PAYMENT_PROOF");

    const scored = scoreEvidenceStrength({
      evidenceClass,
      sourceType: "payment_signal",
      contentJson: { amount: 49.99, currency: "USD" },
      contentSummary: "Customer paid monthly subscription",
      priorTaskCompletionCount: 0,
      userHasHighEvidence: false,
    });

    expect(scored.evidence_strength).toBe("HIGH");
    expect(scored.integrity_flags).toEqual([]);
  });

  it("flags REPEATED_LOW_VALUE on the 6th TASK_COMPLETION_COUNT without HIGH evidence", () => {
    const evidenceClass = classifyEvidence("user_upload", { type: "task_count", count: 1 });
    expect(evidenceClass).toBe("TASK_COMPLETION_COUNT");

    const scored = scoreEvidenceStrength({
      evidenceClass,
      sourceType: "user_upload",
      contentJson: { type: "task_count", count: 1 },
      priorTaskCompletionCount: 5,
      userHasHighEvidence: false,
    });

    expect(scored.evidence_strength).toBe("LOW");
    expect(scored.integrity_flags).toContain("REPEATED_LOW_VALUE");
  });

  it("classifies user file upload as DIRECT_ARTIFACT", () => {
    const evidenceClass = classifyEvidence("user_upload", {
      proof_file_ids: ["file-123"],
      mime_type: "image/png",
    });
    expect(evidenceClass).toBe("DIRECT_ARTIFACT");
  });

  it("classifies plan_or_intention as NONE strength", () => {
    const evidenceClass = classifyEvidence("user_upload", { type: "plan_or_intention", plan: "launch soon" });
    const scored = scoreEvidenceStrength({
      evidenceClass,
      sourceType: "user_upload",
      contentJson: { type: "plan_or_intention" },
      priorTaskCompletionCount: 0,
      userHasHighEvidence: false,
    });
    expect(evidenceClass).toBe("INTENTION_OR_PLAN");
    expect(scored.evidence_strength).toBe("NONE");
  });
});
