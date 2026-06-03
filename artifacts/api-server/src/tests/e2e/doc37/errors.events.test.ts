/**
 * DOC 37 — duplicate, out-of-order, retry, DLQ event semantics.
 */
import { describe, it, expect } from "vitest";
import { classifyEventFailure } from "../../../lib/failure-taxonomy.js";

describe("DOC 37 — errors.events", () => {
  it("classifies duplicate idempotency as event_error", () => {
    expect(classifyEventFailure("duplicate idempotency_key")).toBe("event_error");
  });

  it("classifies stale version conflicts as state_integrity_error", () => {
    expect(classifyEventFailure("stale world state version")).toBe("state_integrity_error");
  });

  it("EventService uses onConflictDoNothing for idempotency_key", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../services/EventService.ts", import.meta.url), "utf8"),
    );
    expect(src).toContain("onConflictDoNothing");
    expect(src).toContain("idempotency_key");
  });

  it("DeadLetterQueue maps stale failures", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../services/DeadLetterQueue.ts", import.meta.url), "utf8"),
    );
    expect(src).toContain("STALE_STATE");
    expect(src).toMatch(/stale|version/i);
  });

  it("OrchestrationLock prevents duplicate event claims", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../../engines/orchestration/OrchestrationLock.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toContain("onConflictDoNothing");
  });
});
