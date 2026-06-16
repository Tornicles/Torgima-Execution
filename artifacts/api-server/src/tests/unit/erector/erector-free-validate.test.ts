import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  erectorFreeValidateBodySchema,
  FREE_VALIDATION_LIMIT,
  runErectorFreeBhudhi,
} from "../../../routes/erector/free.js";
import { ERECTOR_FREE_FALLBACK } from "../../../bhudhi/fallbacks/erector-fallbacks.js";

vi.mock("../../../bhudhi/TriggerRouter.js", () => ({
  routeBhudhiRequest: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  erectorFreeValidations: {
    id: "id",
    fingerprint: "fingerprint",
  },
}));

import { routeBhudhiRequest } from "../../../bhudhi/TriggerRouter.js";

describe("Erector Free validation API", () => {
  beforeEach(() => {
    vi.mocked(routeBhudhiRequest).mockReset();
  });

  it("validates request body schema", () => {
    const parsed = erectorFreeValidateBodySchema.safeParse({
      industry: "SaaS for retailers",
      location: "United States",
      budget_range: "1k_5k",
      timeline: "3_months",
      fingerprint: "fp_test_12345678",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing industry", () => {
    const parsed = erectorFreeValidateBodySchema.safeParse({
      industry: "",
      location: "Nigeria",
      budget_range: "under_1k",
      timeline: "1_month",
      fingerprint: "fp_test_12345678",
    });
    expect(parsed.success).toBe(false);
  });

  it("uses Bhudhi output when pipeline succeeds", async () => {
    vi.mocked(routeBhudhiRequest).mockResolvedValue({
      ok: true,
      fallbackUsed: false,
      logId: "log-1",
      output: {
        outputType: "erector_free_report",
        contractVersion: "1.0",
        stateVersion: 0,
        confidence: "MEDIUM",
        data: { ...ERECTOR_FREE_FALLBACK, validation_score: 72 },
        missingFields: [],
        warnings: [],
        forbiddenActionRequested: false,
      },
    });

    const result = await runErectorFreeBhudhi({
      industry: "Consulting",
      location: "Canada",
      budget_range: "5k_20k",
      timeline: "6_months",
      fingerprint: "fp_test_12345678",
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.data.validation_score).toBe(72);
    expect(routeBhudhiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerType: "ERECTOR_FREE_VALIDATION",
        requestedMode: "INTERPRET",
      }),
    );
  });

  it("falls back deterministically when Bhudhi fails", async () => {
    vi.mocked(routeBhudhiRequest).mockResolvedValue({
      ok: false,
      fallbackUsed: true,
      logId: "",
      failureReason: "provider_error",
    });

    const result = await runErectorFreeBhudhi({
      industry: "Local bakery",
      location: "Kenya",
      budget_range: "under_1k",
      timeline: "1_month",
      fingerprint: "fp_test_12345678",
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.data.verdict).toBe("adjust");
    expect(result.data.validation_score).toBe(ERECTOR_FREE_FALLBACK.validation_score);
  });

  it("enforces free validation limit constant", () => {
    expect(FREE_VALIDATION_LIMIT).toBe(3);
  });
});
