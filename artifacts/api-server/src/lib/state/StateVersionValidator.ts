import { validateOutput as validateBhudhiEnvelope } from "../../bhudhi/OutputValidator.js";
import type { BhudhiOutputEnvelope, BhudhiOutputType } from "../../types/bhudhi.js";
import type { Response } from "express";
import { failure } from "../utils.js";
import { getCurrentStateVersion } from "../../services/StateMutationService.js";

export interface RequestVersionCheck {
  ok: boolean;
  error?: "STATE_VERSION_MISMATCH";
  currentStateVersion?: number;
  message?: string;
}

/** DOC15 — reject client mutations when expected version does not match blueprint. */
export function assertRequestStateVersion(
  expectedStateVersion: number,
  currentStateVersion: number,
): RequestVersionCheck {
  if (expectedStateVersion !== currentStateVersion) {
    return {
      ok: false,
      error: "STATE_VERSION_MISMATCH",
      currentStateVersion,
      message: "Refreshing...",
    };
  }
  return { ok: true, currentStateVersion };
}

/** DOC15 — discard Bhudhi output when envelope.stateVersion is stale. */
export function validateBhudhiOutputStateVersion(
  raw: unknown,
  expectedType: BhudhiOutputType,
  currentStateVersion: number,
): { ok: true; envelope: BhudhiOutputEnvelope } | { ok: false; stale: boolean; errors: string[] } {
  const result = validateBhudhiEnvelope(raw, expectedType, currentStateVersion);
  if (!result.ok) {
    const stale = result.errors.some((e) => e.toLowerCase().includes("stale"));
    return { ok: false, stale, errors: result.errors };
  }
  return { ok: true, envelope: raw as BhudhiOutputEnvelope };
}

export interface StaleStateBody {
  error: "STATE_CHANGED";
  currentStateVersion: number;
  message: "Refreshing...";
}

export function buildStaleStateBody(currentStateVersion: number): StaleStateBody {
  return {
    error: "STATE_CHANGED",
    currentStateVersion,
    message: "Refreshing...",
  };
}

/** DOC15 — 409 response for stale mutations on critical routes. */
export function respondStaleState(res: Response, currentStateVersion: number): void {
  const body = buildStaleStateBody(currentStateVersion);
  failure(res, "STATE_CHANGED", body.message, 409, {
    retryable: true,
    detail: JSON.stringify(body),
  });
}

/** Resolve current blueprint version when handling STALE_STATE in route catch blocks. */
export async function resolveStaleCurrentVersion(blueprintId: string | null | undefined): Promise<number> {
  if (!blueprintId) return 0;
  return getCurrentStateVersion(blueprintId);
}
