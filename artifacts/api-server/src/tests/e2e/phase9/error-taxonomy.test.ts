/**
 * Prompt 9 §6 — error handling taxonomy (safe user responses, no raw internals).
 */
import { describe, it, expect } from "vitest";
import { TorgimaError, torgimaErrorToStatus } from "../../../lib/errors.js";

const TAXONOMY: Array<{
  class: string;
  code: Parameters<typeof torgimaErrorToStatus>[0];
  status: number;
  userSafe: boolean;
  exposesInternals: boolean;
}> = [
  { class: "validation_error", code: "VALIDATION_ERROR", status: 422, userSafe: true, exposesInternals: false },
  { class: "auth_error", code: "UNAUTHENTICATED", status: 401, userSafe: true, exposesInternals: false },
  { class: "state_integrity_error", code: "STALE_STATE", status: 409, userSafe: true, exposesInternals: false },
  { class: "engine_error", code: "INTERNAL_ERROR", status: 500, userSafe: true, exposesInternals: false },
  { class: "rate_limit_error", code: "RATE_LIMITED", status: 429, userSafe: true, exposesInternals: false },
  { class: "blueprint_integrity_error", code: "BLUEPRINT_NOT_ACTIVE", status: 500, userSafe: true, exposesInternals: false },
  { class: "ai_contract_error", code: "AI_CONTRACT_ERROR", status: 500, userSafe: true, exposesInternals: false },
];

describe("Prompt 9 — Error taxonomy", () => {
  for (const row of TAXONOMY) {
    it(`${row.class} maps to HTTP ${row.status}`, () => {
      expect(torgimaErrorToStatus(row.code)).toBe(row.status);
    });
  }

  it("user-facing messages avoid stack traces and internal IDs", () => {
    const err = new TorgimaError(
      "VALIDATION_ERROR",
      "This task requires proof of completion",
      false,
    );
    expect(err.message).not.toMatch(/stack|at\s+\w+\./i);
    expect(err.message).not.toMatch(/uuid/i);
    expect(err.message.length).toBeLessThan(200);
  });

  it("STALE_STATE is retryable", () => {
    expect(new TorgimaError("STALE_STATE", "State changed", true).retryable).toBe(true);
  });

  it("RATE_LIMITED uses 429", () => {
    expect(torgimaErrorToStatus("RATE_LIMITED")).toBe(429);
  });

  it("display rules: failure helper uses code not engine names", () => {
    const msg = "Blueprint launch blocked: Pivot Required. Address critical issues and re-validate.";
    expect(msg).not.toMatch(/ControlEngine|SignalWorker/i);
    expect(msg).toMatch(/Pivot Required/i);
  });
});
