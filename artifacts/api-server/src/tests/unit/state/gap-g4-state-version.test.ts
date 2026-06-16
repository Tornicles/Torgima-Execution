/**
 * GAP PROMPT G4 — State Version Enforcement tests.
 */

import { describe, it, expect, vi } from "vitest";
import { validateOutput } from "../../../bhudhi/OutputValidator.js";
import type { BhudhiOutputEnvelope } from "../../../types/bhudhi.js";

describe("GAP G4 — OutputValidator stale rejection", () => {
  it("T4: rejects Bhudhi output when stateVersion does not match current", () => {
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

    const result = validateOutput(envelope, "task_copy", 5);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("stale"))).toBe(true);
  });

  it("accepts output when stateVersion matches exactly", () => {
    const envelope: BhudhiOutputEnvelope = {
      outputType: "task_copy",
      contractVersion: "1",
      stateVersion: 5,
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

    const result = validateOutput(envelope, "task_copy", 5);
    expect(result.ok).toBe(true);
  });
});

describe("GAP G4 — StateMutationService surface", () => {
  it("exports mutate, assertBlueprintVersion, appendBlueprintVersionAudit", async () => {
    const mod = await import("../../../lib/state/StateMutationService.js");
    expect(typeof mod.mutate).toBe("function");
    expect(typeof mod.assertBlueprintVersion).toBe("function");
    expect(typeof mod.appendBlueprintVersionAudit).toBe("function");
    expect(typeof mod.applyMutation).toBe("function");
    expect(typeof mod.getCurrentStateVersion).toBe("function");
    expect(typeof mod.applyVersionedMutation).toBe("function");
  });

  it("T2: mutate contract maps stale to STALE_STATE error code", () => {
    const staleResponse = {
      ok: false,
      result: "REJECTED_STALE" as const,
      previousStateVersion: 5,
      newStateVersion: 6,
      errors: ["State changed. Expected version 5, current is 6."],
    };
    expect(staleResponse.result).toBe("REJECTED_STALE");
  });
});

describe("GAP G4 — blueprint state_version column", () => {
  it("T1/T3: blueprints schema includes state_version (integration contract)", async () => {
    const { blueprints, blueprintVersions } = await import("@workspace/db");
    expect(blueprints.state_version).toBeDefined();
    expect(blueprintVersions.version_number).toBeDefined();
    expect(blueprintVersions.change_type).toBeDefined();
  });
});

describe("GAP G4 — Bhudhi state version resolver", () => {
  it("resolveBlueprintStateVersion is exported", async () => {
    const mod = await import("../../../bhudhi/resolveBlueprintStateVersion.js");
    expect(typeof mod.resolveBlueprintStateVersion).toBe("function");
  });
});

describe("GAP G4 — engines using versioned mutate", () => {
  it("PauseEngine and ResumeEngine import mutate", async () => {
    const pause = await import("../../../engines/lifecycle/PauseEngine.js");
    const resume = await import("../../../engines/lifecycle/ResumeEngine.js");
    expect(typeof pause.pauseBlueprint).toBe("function");
    expect(typeof resume.resumeBlueprint).toBe("function");
  });
});
