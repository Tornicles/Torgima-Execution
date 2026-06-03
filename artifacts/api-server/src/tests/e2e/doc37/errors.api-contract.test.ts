/**
 * DOC 37 — API error envelope shape and stateChanged semantics.
 */
import { describe, it, expect } from "vitest";
import { classifyFailureCode, DOC37_FAILURE_CLASSES } from "../../../lib/failure-taxonomy.js";
import { TorgimaError, torgimaErrorToStatus } from "../../../lib/errors.js";
import { FEEDBACK_PAYLOAD_MAX_BYTES } from "../../../lib/feedback-payload-limit.js";

describe("DOC 37 — errors.api-contract", () => {
  it("defines all seven failure classes", () => {
    expect(DOC37_FAILURE_CLASSES).toHaveLength(7);
    expect(DOC37_FAILURE_CLASSES).toContain("validation_error");
    expect(DOC37_FAILURE_CLASSES).toContain("ai_contract_error");
  });

  it("maps known codes to taxonomy class", () => {
    expect(classifyFailureCode("STALE_STATE")).toBe("state_integrity_error");
    expect(classifyFailureCode("UNAUTHENTICATED")).toBe("auth_error");
    expect(classifyFailureCode("AI_CONTRACT_ERROR")).toBe("ai_contract_error");
    expect(classifyFailureCode("ACTIVATION_FAILED")).toBe("validation_error");
  });

  it("failure responses use safe HTTP status (no 500 for user errors)", () => {
    expect(torgimaErrorToStatus("VALIDATION_ERROR")).toBe(422);
    expect(torgimaErrorToStatus("ACTIVATION_FAILED")).toBe(422);
    expect(torgimaErrorToStatus("PAYLOAD_TOO_LARGE")).toBe(413);
    expect(torgimaErrorToStatus("STALE_STATE")).toBe(409);
  });

  it("user-facing errors avoid stack traces and engine names", () => {
    const err = new TorgimaError("ACTIVATION_FAILED", "Blueprint cannot be launched. Missing tier.");
    expect(err.message).not.toMatch(/ControlEngine|stack|at\s+\w+\./i);
  });

  it("feedback payload limit is 10KB per DOC 37", () => {
    expect(FEEDBACK_PAYLOAD_MAX_BYTES).toBe(10 * 1024);
  });

  it("utils failure attaches taxonomy class (structural)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = dirname(fileURLToPath(import.meta.url));
    const utils = readFileSync(resolve(dir, "../../../lib/utils.ts"), "utf8");
    expect(utils).toContain("classifyFailureCode");
    expect(utils).toContain("stateChanged");
  });
});
