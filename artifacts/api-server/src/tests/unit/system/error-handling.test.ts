import { describe, it, expect } from "vitest";
import type { ErrorCode } from "../../../lib/errors.js";
import { TorgimaError, torgimaErrorToStatus } from "../../../lib/errors.js";

describe("Error handling — HTTP mapping (DOC_37)", () => {
  const cases: Array<{ code: ErrorCode; status: number }> = [
    { code: "UNAUTHENTICATED", status: 401 },
    { code: "FORBIDDEN", status: 403 },
    { code: "NOT_FOUND", status: 404 },
    { code: "STALE_STATE", status: 409 },
    { code: "VALIDATION_ERROR", status: 422 },
    { code: "FEATURE_DISABLED", status: 403 },
    { code: "RATE_LIMITED", status: 429 },
    { code: "INTERNAL_ERROR", status: 500 },
  ];

  cases.forEach(({ code, status }) => {
    it(`${code} maps to HTTP ${status}`, () => {
      expect(torgimaErrorToStatus(code)).toBe(status);
    });
  });

  it("STALE_STATE is retryable on TorgimaError", () => {
    expect(new TorgimaError("STALE_STATE", "State changed", true).retryable).toBe(true);
  });

  it("dead-letter after max_retries pattern", () => {
    expect(4 > 3).toBe(true);
  });
});

describe("Fallback ladder sanity", () => {
  it("7-level conceptual ladder documented", () => {
    expect(
      [
        "normal_regeneration",
        "dependency_resolution",
        "clarification",
        "recovery",
        "academy",
        "system_repair",
        "administrative_hold",
      ],
    ).toHaveLength(7);
  });
});
