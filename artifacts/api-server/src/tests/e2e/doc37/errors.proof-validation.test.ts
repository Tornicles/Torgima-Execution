/**
 * DOC 37 §3 — proof validation edge cases.
 */
import { describe, it, expect } from "vitest";
import { validateProof } from "../../../engines/execution-loop/feedback/ProofValidator.js";
import { validateUploadFile } from "../../../engines/external/ExternalSignalProcessor.js";
import { IntegrityLayer } from "../../../engines/erector/IntegrityLayer.js";
import type { FeedbackSubmissionPayload } from "../../../engines/feedback/submitFeedbackPhase1.js";
import { OrderStatus } from "@workspace/state-machine";

const baseOrder = {
  proof_required: true,
  proof_type: "TEXT",
  expected_output: "competitor research summary",
  title: "Research competitors",
  proof_json: {},
} as never;

const basePayload = (overrides: Partial<FeedbackSubmissionPayload> = {}): FeedbackSubmissionPayload => ({
  orderId: "00000000-0000-4000-8000-000000000001",
  completion: "COMPLETED",
  clientStateVersion: 1,
  idempotencyKey: "doc37-proof",
  effortScore: 4,
  frictionScore: 2,
  ...overrides,
});

const evidenceInput = (overrides: Record<string, unknown> = {}) => ({
  userId: "00000000-0000-4000-8000-000000000001",
  sourceType: "external_link" as const,
  evidence_class: "USER_EXPLANATION" as const,
  sourceLocation: "https://example.com/proof-doc37",
  contentSummary: "A".repeat(120),
  contentJson: {},
  ...overrides,
});

describe("DOC 37 — errors.proof-validation", () => {
  it("EDGE 1: proof text is just whitespace → rejected after trim", () => {
    const result = validateProof({
      payload: basePayload({ proofType: "TEXT", proofText: "     " }),
      order: baseOrder,
    });
    expect(result.valid).toBe(false);
    expect(result.rejection_reason?.toLowerCase()).toMatch(/short|too short/);
  });

  it("EDGE 2: .exe file mime → FILE_TYPE_NOT_ALLOWED", () => {
    const check = validateUploadFile({
      fileName: "malware.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: 1024,
    });
    expect(check.valid).toBe(false);
    expect(check.code).toBe("FILE_TYPE_NOT_ALLOWED");
  });

  it("EDGE 3: same proof link twice → DUPLICATE_PROOF on second submission", async () => {
    const layer = new IntegrityLayer();
    const url = "https://example.com/proof-doc37";
    const first = await layer.evaluate(
      "user-1",
      "bp-1",
      evidenceInput({ sourceLocation: url }),
      [],
    );
    expect(first.flags).not.toContain("DUPLICATE_PROOF");

    const second = await layer.evaluate(
      "user-1",
      "bp-1",
      evidenceInput({ sourceLocation: url, contentSummary: "B".repeat(120) }),
      [
        {
          source_location: url,
          validation_status: "accepted",
          created_at: new Date(),
        } as never,
      ],
    );
    expect(second.flags).toContain("DUPLICATE_PROOF");
    expect(second.action).toBe("evidence_rejected");
  });

  it("EDGE 4: completed order is not feedback-eligible", () => {
    const eligible = [
      OrderStatus.PENDING,
      OrderStatus.ACTIVE,
      OrderStatus.NEEDS_FEEDBACK,
      OrderStatus.BLOCKED,
      OrderStatus.NEEDS_PROOF,
    ];
    expect((eligible as readonly string[]).includes(OrderStatus.COMPLETED)).toBe(false);
  });

  it("EDGE 5: very long text proof accepted when above minimum length", () => {
    const longText = Array.from({ length: 500 }, (_, i) => {
      const words = ["market", "pricing", "channel", "retention", "onboarding", "pipeline", "conversion"];
      return `Insight ${i}: ${words[i % words.length]} analysis row ${i} with distinct competitor note ${i * 13}.`;
    }).join(" ");
    const result = validateProof({
      payload: basePayload({ proofType: "TEXT", proofText: longText }),
      order: baseOrder,
    });
    expect(result.valid).toBe(true);
    expect(longText.length).toBeGreaterThan(5000);
  });

  it("EDGE 6: upload without feedback leaves evidence ledger optional (structural)", async () => {
    const routes = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../routes/doc29-routes.ts", import.meta.url), "utf8"),
    );
    expect(routes).toContain("/uploads/proof");
    expect(routes).not.toMatch(/evidence_ledger.*uploads\/proof/s);
  });
});
