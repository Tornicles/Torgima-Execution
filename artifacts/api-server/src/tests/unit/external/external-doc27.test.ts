/**
 * DOC27 — External signal integration tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import {
  scoreExternalTrust,
  canTriggerOutcomeReward,
} from "../../../engines/external/ExternalTrustScorer.js";
import {
  processFileUpload,
  validateUploadFile,
} from "../../../engines/external/ExternalSignalProcessor.js";
import * as WebhookRouter from "../../../engines/external/WebhookRouter.js";
import { EventTypes } from "../../../types/eventContracts.js";

const { submitMock, duplicateState } = vi.hoisted(() => ({
  submitMock: vi.fn(async () => ({
    evidence_id: "evidence-doc27-1",
    evidence_class: "DIRECT_ARTIFACT",
    evidence_strength: "MEDIUM",
    integrity_flags: [],
  })),
  duplicateState: { externalId: null as string | null },
}));

const mockEvidenceId = "evidence-doc27-1";
let healthLogInserts = 0;
let writeEventCalls: Array<Record<string, unknown>> = [];

vi.mock("../../../services/erector/evidence/EvidenceLedgerService.js", () => ({
  evidenceLedgerService: {
    submit: submitMock,
  },
}));

vi.mock("../../../engines/external/EvidenceStorage.js", () => ({
  storeEvidenceFile: vi.fn(() => ({
    storagePath: "evidence/user-1/bp-1/sample.pdf",
    publicUrl: "https://storage.example/evidence/user-1/bp-1/sample.pdf",
  })),
}));

vi.mock("../../../services/EventService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/EventService.js")>();
  return {
    ...actual,
    writeEvent: vi.fn(async (input: Record<string, unknown>) => {
      writeEventCalls.push(input);
    }),
  };
});

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () =>
          duplicateState.externalId
            ? [{ id: "test-id", payload: { external_id: duplicateState.externalId }, source: "stripe" }]
            : [],
        ),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => {
        healthLogInserts += 1;
        return { catch: vi.fn() };
      }),
    })),
  },
  erectorEvidenceLedger: { user_id: "user_id", blueprint_id: "blueprint_id", evidence_strength: "evidence_strength", created_at: "created_at", integrity_flags: "integrity_flags" },
  externalSignals: { id: "id", payload: "payload", source_name: "source_name" },
  systemHealthLogs: {},
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => args),
    and: vi.fn((...args: unknown[]) => args),
    gte: vi.fn((...args: unknown[]) => args),
    sql: vi.fn((strings: TemplateStringsArray) => strings.join("")),
  };
});

describe("external-signal", () => {
  beforeEach(() => {
    healthLogInserts = 0;
    writeEventCalls = [];
    duplicateState.externalId = null;
    submitMock.mockClear();
  });

  it("trust scorer applies DOC27 base rules", () => {
    const upload = scoreExternalTrust({
      sourceType: "user_upload",
      fileType: "application/pdf",
      description: "Detailed proof of customer payment received yesterday",
    });
    expect(upload.level).toBe("HIGH");
    expect(upload.score).toBeGreaterThanOrEqual(70);

    const link = scoreExternalTrust({
      sourceType: "external_link",
      url: "https://dashboard.stripe.com/payments/ch_123",
    });
    expect(link.score).toBeGreaterThan(30);
    expect(canTriggerOutcomeReward("LOW")).toBe(false);
    expect(canTriggerOutcomeReward("HIGH")).toBe(true);
  });

  it("TEST 1: valid PDF upload creates evidence record with HIGH trust", async () => {
    const pdf = Buffer.alloc(2 * 1024 * 1024, 1);
    const result = await processFileUpload({
      userId: "user-1",
      file: {
        fileName: "proof.pdf",
        mimeType: "application/pdf",
        sizeBytes: pdf.length,
        buffer: pdf,
      },
      context: {
        blueprintId: "bp-1",
        description: "Customer payment receipt for March launch milestone",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trust_level).toBe("HIGH");
      expect(result.evidence_id).toBe(mockEvidenceId);
      expect(result.evidence_class).toBe("DIRECT_ARTIFACT");
    }
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "user_upload" }),
    );
    expect(writeEventCalls[0]).toMatchObject({
      eventType: EventTypes.EXTERNAL_SIGNAL_RECEIVED,
      payload: expect.objectContaining({ signal_type: "user_upload", trust_level: "HIGH" }),
    });
  });

  it("TEST 2: invalid file type rejected without evidence write", async () => {
    const validation = validateUploadFile({
      fileName: "malware.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: 1024,
    });
    expect(validation.valid).toBe(false);
    expect(validation.code).toBe("FILE_TYPE_NOT_ALLOWED");
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("TEST 3: valid Stripe webhook creates payment evidence and outcome validation event", async () => {
    const payload = {
      id: "evt_stripe_1",
      type: "invoice.paid",
      metadata: { user_id: "user-1", blueprint_id: "bp-1" },
    };
    const parsed = WebhookRouter.parseWebhookPayload("stripe", payload);
    expect(parsed?.signal_type).toBe("payment_confirmed");

    submitMock.mockResolvedValueOnce({
      evidence_id: mockEvidenceId,
      evidence_class: "PAYMENT_PROOF",
      evidence_strength: "HIGH",
      integrity_flags: [],
    });

    const result = await WebhookRouter.processWebhook({
      source: "stripe",
      payload,
      signature: "dev-bypass",
      userId: "user-1",
      blueprintId: "bp-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.evidence_id).toBe(mockEvidenceId);
      expect(result.routed_events).toContain(EventTypes.OUTCOME_VALIDATION_REQUESTED);
    }
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "payment_signal" }),
    );
  });

  it("TEST 4: invalid webhook signature rejected with health log", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "test-secret";
    process.env.NODE_ENV = "production";

    const payload = { id: "evt_bad_sig", type: "invoice.paid" };
    expect(WebhookRouter.verifyWebhookSignature("stripe", payload, "invalid-signature")).toBe(false);

    const result = await WebhookRouter.processWebhook({
      source: "stripe",
      payload,
      signature: "invalid-signature",
      userId: "user-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.code).toBe("WEBHOOK_SIGNATURE_INVALID");
    }
    expect(healthLogInserts).toBeGreaterThan(0);

    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.NODE_ENV = "test";
  });

  it("TEST 5: duplicate webhook returns duplicate=true without evidence submit", async () => {
    const payload = {
      id: "evt_dup_1",
      type: "invoice.paid",
      metadata: { user_id: "user-1", blueprint_id: "bp-1" },
    };
    duplicateState.externalId = "evt_dup_1";

    const result = await WebhookRouter.processWebhook({
      source: "stripe",
      payload,
      signature: "dev-bypass",
      userId: "user-1",
      blueprintId: "bp-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.duplicate).toBe(true);
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("verifyWebhookSignature accepts valid HMAC signature", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "test-secret";
    process.env.NODE_ENV = "production";
    const payload = { id: "evt_ok", type: "invoice.paid" };
    const raw = JSON.stringify(payload);
    const signature = createHmac("sha256", "test-secret").update(raw).digest("hex");
    expect(WebhookRouter.verifyWebhookSignature("stripe", payload, signature)).toBe(true);
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.NODE_ENV = "test";
  });
});
