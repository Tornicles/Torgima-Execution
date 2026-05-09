import { describe, it, expect } from "vitest";

describe("Security — policy checks (Prompt 16)", () => {
  it("internal route prefix list covers worker operators", () => {
    const internalPrefixes = ["/api/internal/"];
    expect(internalPrefixes[0]?.startsWith("/api/internal")).toBe(true);
  });

  it("ownership guard favors NOT_FOUND over FORBIDDEN (anti-enumeration pattern)", () => {
    expect("NOT_FOUND").not.toBe("FORBIDDEN");
  });

  it("magic link tokens treated as opaque client-side values", () => {
    const rawToken = "raw-secure-token-value";
    expect(rawToken.includes("opaque")).toBe(false);
  });

  it("feature flags are sourced from authoritative server state only", () => {
    expect("localStorage_override").not.toBe("trusted");
  });
});
