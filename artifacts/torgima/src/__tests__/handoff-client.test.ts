import { describe, expect, it } from "vitest";
import { HANDOFF_PREFILL_KEY, HANDOFF_TOKEN_KEY, INTAKE_SKIP_KEY, PENDING_HANDOFF_TOKEN_KEY } from "@/lib/handoff-client";

describe("handoff-client storage keys", () => {
  it("uses stable session storage keys", () => {
    expect(PENDING_HANDOFF_TOKEN_KEY).toBe("torgima_pending_handoff_token");
    expect(HANDOFF_PREFILL_KEY).toBe("torgima_handoff_prefill_v1");
    expect(HANDOFF_TOKEN_KEY).toBe("torgima_handoff_token");
    expect(INTAKE_SKIP_KEY).toBe("torgima_intake_skip_v1");
  });
});
