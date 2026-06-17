import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  erectorFreeValidateBodySchema,
  FREE_VALIDATION_LIMIT,
  runErectorFreeBhudhi,
} from "../../../routes/erector/free.js";
import { ERECTOR_FREE_FALLBACK } from "../../../bhudhi/fallbacks/erector-fallbacks.js";
import {
  buildFreeValidationResult,
  mapVerdictToCustomerLabel,
  parseFreeValidateBody,
} from "../../../services/erector/free-validation-contract.js";

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
    created_at: "created_at",
    ip_address: "ip_address",
    report_json: "report_json",
  },
}));

import { routeBhudhiRequest } from "../../../bhudhi/TriggerRouter.js";

const validInput = {
  idea_or_goal: "I want to create a fitness content brand for beginners",
  industry_or_domain: "Health/Fitness Content",
  location: "Brazil",
  budget_range: "$0 - $500",
  timeline: "90 days",
  additional_context: "I can work part time and use TikTok and Instagram.",
  fingerprint: "fp_test_12345678",
};

describe("Erector Free validation API", () => {
  beforeEach(() => {
    vi.mocked(routeBhudhiRequest).mockReset();
  });

  it("validates request body schema with idea_or_goal", () => {
    const parsed = parseFreeValidateBody(validInput);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.idea_or_goal).toContain("fitness content brand");
      expect(parsed.data.industry_or_domain).toBe("Health/Fitness Content");
    }
  });

  it("maps optional_context to additional_context for backward compatibility", () => {
    const parsed = parseFreeValidateBody({
      idea_or_goal: "Launch a local coffee subscription box",
      industry_or_domain: "Food & Beverage",
      location: "Portland",
      budget_range: "under_1k",
      timeline: "3_months",
      optional_context: "Weekend-only operations",
      fingerprint: "fp_test_12345678",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.additional_context).toBe("Weekend-only operations");
    }
  });

  it("accepts legacy industry-only body when idea is long enough", () => {
    const parsed = parseFreeValidateBody({
      industry: "Consulting for small retailers in emerging markets",
      location: "Kenya",
      budget_range: "1k_5k",
      timeline: "6_months",
      fingerprint: "fp_test_12345678",
    });
    expect(parsed.ok).toBe(true);
  });

  it("rejects extremely short goal", () => {
    const parsed = parseFreeValidateBody({
      idea_or_goal: "hi",
      industry_or_domain: "SaaS",
      location: "US",
      budget_range: "under_1k",
      timeline: "1_month",
      fingerprint: "fp_test_12345678",
    });
    expect(parsed.ok).toBe(false);
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

    const body = parseFreeValidateBody(validInput);
    expect(body.ok).toBe(true);
    if (!body.ok) return;

    const result = await runErectorFreeBhudhi(body.data);

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

    const body = parseFreeValidateBody(validInput);
    expect(body.ok).toBe(true);
    if (!body.ok) return;

    const result = await runErectorFreeBhudhi(body.data);

    expect(result.fallbackUsed).toBe(true);
    expect(result.data.verdict).toBe("adjust");
    expect(result.data.validation_score).toBe(ERECTOR_FREE_FALLBACK.validation_score);
  });

  it("maps internal verdict tokens to customer-facing labels", () => {
    expect(mapVerdictToCustomerLabel("proceed")).toBe("Strong direction");
    expect(mapVerdictToCustomerLabel("ADJUST")).toBe("Needs adjustment");
    expect(mapVerdictToCustomerLabel("PIVOT")).toBe("Consider a different angle");
    expect(mapVerdictToCustomerLabel("TEST_FIRST")).toBe("Test before building");
    expect(mapVerdictToCustomerLabel("BLOCKED")).toBe("High risk");
  });

  it("builds canonical free validation result shape", () => {
    const body = parseFreeValidateBody(validInput);
    expect(body.ok).toBe(true);
    if (!body.ok) return;

    const payload = buildFreeValidationResult({
      validationId: "val-1",
      input: body.data,
      bhudhi: ERECTOR_FREE_FALLBACK,
      remainingFree: 2,
      handoffToken: "token-abc",
      handoffExpiresAt: new Date().toISOString(),
    });

    expect(payload.is_free_tier_preview).toBe(true);
    expect(payload.verdict_label).toBe("Needs adjustment");
    expect(payload.top_risks.length).toBeGreaterThanOrEqual(3);
    expect(payload.top_opportunities.length).toBeGreaterThanOrEqual(3);
    expect(payload.upgrade_url).toContain("handoff=token-abc");
    expect(payload.handoff_token).toBe("token-abc");
  });

  it("enforces free validation limit constant", () => {
    expect(FREE_VALIDATION_LIMIT).toBe(3);
  });

  it("exports legacy schema symbol for compatibility", () => {
    expect(erectorFreeValidateBodySchema).toBeTruthy();
  });
});
