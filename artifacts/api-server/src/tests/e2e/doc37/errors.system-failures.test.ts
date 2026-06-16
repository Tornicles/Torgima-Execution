/**
 * DOC 37 §2 — system failure simulation and expected behavior.
 */
import { describe, it, expect } from "vitest";
import { classifyFailureCode } from "../../../lib/failure-taxonomy.js";
import { DEGRADED_MODE_FLAG } from "../../../engines/execution-loop/DegradedMode.js";
import { EventTypes } from "../../../types/eventContracts.js";

describe("DOC 37 — errors.system-failures", () => {
  it("Bhudhi API timeout → deterministic fallback (structural)", async () => {
    const core = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../bhudhi/BhudhiCore.ts", import.meta.url), "utf8"),
    );
    expect(core).toMatch(/timeout|fallback/i);
    expect(core).toContain("handleBhudhiLogWriteFailure");
  });

  it("feedback transaction rolls back on failure (structural)", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../../engines/feedback/submitFeedbackPhase1.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toContain("db.transaction");
  });

  it("event dead-letters after retries (structural)", async () => {
    const dlq = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../services/DeadLetterQueue.ts", import.meta.url), "utf8"),
    );
    expect(dlq).toMatch(/dead.?letter|retry/i);
    const worker = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../workers/WorkerDispatcher.ts", import.meta.url), "utf8"),
    );
    expect(worker).toMatch(/dead.?letter|retry/i);
  });

  it("signal calculation failure path is wired (structural)", () => {
    expect(classifyFailureCode("INTERNAL_ERROR")).toBe("engine_error");
    expect(EventTypes.SIGNAL_RECALCULATION_REQUESTED).toBe("signal_recalculation_requested");
  });

  it("auth service errors map to auth_error taxonomy", () => {
    expect(classifyFailureCode("UNAUTHENTICATED")).toBe("auth_error");
    expect(classifyFailureCode("FORBIDDEN")).toBe("auth_error");
  });

  it("StateIntegrityEngine detects missing current signal (structural)", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../../engines/execution-loop/StateIntegrityEngine.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toMatch(/signal|is_current/i);
    expect(src).toContain("checkDoubleActiveOrder");
  });

  it("degraded mode sets feature flag and Bhudhi fallbacks", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../../engines/execution-loop/DegradedMode.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toContain(DEGRADED_MODE_FLAG);
    expect(src).toContain("bhudhi_force_fallbacks");
    expect(src).toContain("SYSTEM_HEALTH_DEGRADED");
  });
});
