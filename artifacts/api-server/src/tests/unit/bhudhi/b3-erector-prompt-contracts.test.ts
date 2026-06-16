/**
 * DOC B3 — Erector free/paid validation prompt contracts.
 */
import { describe, expect, it } from "vitest";
import { getContract, getContractByName } from "../../../bhudhi/PromptRegistry.js";
import { hasFallbackKey, getFallback } from "../../../bhudhi/FallbackLibrary.js";
import {
  ErectorFreeOutputSchema,
  ErectorPaidOutputSchema,
} from "../../../bhudhi/schemas/erector-schemas.js";
import {
  ERECTOR_FREE_FALLBACK,
  ERECTOR_PAID_FALLBACK,
} from "../../../bhudhi/fallbacks/erector-fallbacks.js";

describe("DOC B3 Erector validation prompt contracts", () => {
  it("validates free fallback against ErectorFreeOutputSchema", () => {
    expect(() => ErectorFreeOutputSchema.parse(ERECTOR_FREE_FALLBACK)).not.toThrow();
  });

  it("validates paid fallback against ErectorPaidOutputSchema", () => {
    expect(() => ErectorPaidOutputSchema.parse(ERECTOR_PAID_FALLBACK)).not.toThrow();
  });

  it("registers erector.free.validate.v1 with INTERPRET mode", () => {
    const contract = getContract("ERECTOR_FREE_VALIDATION");
    expect(contract?.name).toBe("erector.free.validate.v1");
    expect(contract?.mode).toBe("INTERPRET");
    expect(contract?.outputType).toBe("erector_free_report");
    expect(contract?.outputSchema).toBeDefined();
    expect(contract?.fallbackKey).toBe("ERECTOR_FREE_FALLBACK");
    expect(hasFallbackKey("ERECTOR_FREE_FALLBACK")).toBe(true);
    expect(getContractByName("erector.free.validate.v1")).not.toBeNull();
  });

  it("registers erector.paid.validate.v1 with STRUCTURE mode", () => {
    const contract = getContract("ERECTOR_PAID_VALIDATION");
    expect(contract?.name).toBe("erector.paid.validate.v1");
    expect(contract?.mode).toBe("STRUCTURE");
    expect(contract?.outputType).toBe("erector_paid_report");
    expect(contract?.outputSchema).toBeDefined();
    expect(contract?.fallbackKey).toBe("ERECTOR_PAID_FALLBACK");
    expect(hasFallbackKey("ERECTOR_PAID_FALLBACK")).toBe(true);
    expect(getContractByName("erector.paid.validate.v1")).not.toBeNull();
  });

  it("registers erector.state.explain.v1 with EXPLAIN mode", () => {
    const contract = getContract("ERECTOR_STATE_EXPLANATION");
    expect(contract?.name).toBe("erector.state.explain.v1");
    expect(contract?.mode).toBe("EXPLAIN");
    expect(contract?.outputType).toBe("state_explanation");
    expect(hasFallbackKey("ERECTOR_STATE_EXPLAIN_FALLBACK")).toBe(true);
    expect(getContractByName("erector.state.explain.v1")).not.toBeNull();
  });

  it("returns envelope-shaped free fallback quickly", () => {
    const start = Date.now();
    const envelope = getFallback("ERECTOR_FREE_FALLBACK", {}, 0);
    expect(Date.now() - start).toBeLessThan(2000);
    expect(envelope.outputType).toBe("erector_free_report");
    expect(envelope.forbiddenActionRequested).toBe(false);
    expect(ErectorFreeOutputSchema.safeParse(envelope.data).success).toBe(true);
  });
});
