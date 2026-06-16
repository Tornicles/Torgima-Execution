/**
 * DOC15 — State Management and Versioning tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BhudhiOutputEnvelope } from "../../../types/bhudhi.js";
import { TorgimaError } from "../../../lib/errors.js";
import {
  assertRequestStateVersion,
  buildStaleStateBody,
  validateBhudhiOutputStateVersion,
} from "../../../lib/state/StateVersionValidator.js";
import {
  applyMutation,
  applyVersionedMutation,
  throwIfStaleMutation,
} from "../../../lib/state/StateMutationService.js";

describe("state-management — request version validation", () => {
  it("T1: accepts mutation when expectedStateVersion matches current", () => {
    const result = assertRequestStateVersion(3, 3);
    expect(result.ok).toBe(true);
    expect(result.currentStateVersion).toBe(3);
  });

  it("T2: rejects stale mutation when expectedStateVersion is behind current", () => {
    const result = assertRequestStateVersion(2, 3);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("STATE_VERSION_MISMATCH");
    expect(result.currentStateVersion).toBe(3);
    expect(result.message).toBe("Refreshing...");
  });
});

describe("state-management — mutation service facade", () => {
  it("exports applyMutation, applyVersionedMutation, and throwIfStaleMutation", async () => {
    expect(typeof applyMutation).toBe("function");
    expect(typeof applyVersionedMutation).toBe("function");
    expect(typeof throwIfStaleMutation).toBe("function");

    const mod = await import("../../../lib/state/index.js");
    expect(typeof mod.writeBlueprintVersion).toBe("function");
    expect(typeof mod.respondStaleState).toBe("function");
  });

  it("T2: throwIfStaleMutation maps REJECTED_STALE to STALE_STATE", () => {
    expect(() =>
      throwIfStaleMutation({
        ok: false,
        result: "REJECTED_STALE",
        previousStateVersion: 2,
        newStateVersion: 3,
        errors: ["State changed. Expected version 2, current is 3."],
      }),
    ).toThrow(TorgimaError);
  });

  it("T1: throwIfStaleMutation returns data for APPLIED mutations", () => {
    const data = throwIfStaleMutation({
      ok: true,
      result: "APPLIED",
      previousStateVersion: 2,
      newStateVersion: 3,
      data: { feedbackId: "fb-1" },
    });
    expect(data).toEqual({ feedbackId: "fb-1" });
  });
});

describe("state-management — Bhudhi stale output rejection", () => {
  it("T3: discards Bhudhi output when stateVersion does not match blueprint", () => {
    const envelope: BhudhiOutputEnvelope = {
      outputType: "task_copy",
      contractVersion: "1",
      stateVersion: 4,
      confidence: "HIGH",
      forbiddenActionRequested: false,
      missingFields: [],
      warnings: [],
      data: {
        title: "Test",
        instruction: "Do the thing",
        successCriteria: "Done",
        estimatedEffortLabel: "SMALL",
      },
    };

    const result = validateBhudhiOutputStateVersion(envelope, "task_copy", 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stale).toBe(true);
      expect(result.errors.some((e) => e.toLowerCase().includes("stale"))).toBe(true);
    }
  });
});

describe("state-management — dashboard projection fields", () => {
  it("T4: dashboard projection includes stateVersion and projectionVersion", () => {
    const dashboardPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../services/DashboardService.ts",
    );
    const src = readFileSync(dashboardPath, "utf8");
    expect(src).toContain("stateVersion");
    expect(src).toContain("projectionVersion: Date.now()");
    expect(src).toContain("pendingSync");
  });

  it("buildStaleStateBody matches DOC15 conflict contract", () => {
    expect(buildStaleStateBody(7)).toEqual({
      error: "STATE_CHANGED",
      currentStateVersion: 7,
      message: "Refreshing...",
    });
  });
});

describe("state-management — schema contracts", () => {
  it("blueprints.state_version column exists", async () => {
    const { blueprints, blueprintMutations } = await import("@workspace/db");
    expect(blueprints.state_version).toBeDefined();
    expect(blueprintMutations.mutation_type).toBeDefined();
  });
});
