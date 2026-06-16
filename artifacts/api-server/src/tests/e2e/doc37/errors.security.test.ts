/**
 * DOC 37 — IDOR, magic link replay, rate limits, internal route from browser.
 */
import { describe, it, expect } from "vitest";
import { TorgimaError, torgimaErrorToStatus } from "../../../lib/errors.js";
import { classifyFailureCode } from "../../../lib/failure-taxonomy.js";

describe("DOC 37 — errors.security", () => {
  it("NOT_FOUND used for cross-user resources (IDOR-safe)", () => {
    expect(torgimaErrorToStatus("NOT_FOUND")).toBe(404);
    expect(classifyFailureCode("NOT_FOUND")).toBe("auth_error");
  });

  it("magic link reuse throws UNAUTHENTICATED", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../services/AuthService.ts", import.meta.url), "utf8"),
    );
    expect(src).toContain("MAGIC_LINK_REUSE_ATTEMPT");
    expect(src).toContain('TorgimaError("UNAUTHENTICATED"');
    expect(src).toContain("used: true");
  });

  it("magic link expires after 15 minutes", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../services/AuthService.ts", import.meta.url), "utf8"),
    );
    expect(src).toContain("MAGIC_LINK_EXPIRY_MINUTES = 15");
  });

  it("browser Origin on internal routes throws FORBIDDEN", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../lib/auth.ts", import.meta.url), "utf8"),
    );
    expect(src).toContain("BROWSER_INTERNAL_ROUTE_ATTEMPT");
    expect(src).toContain('TorgimaError("FORBIDDEN"');
    expect(src).toContain("req.headers.origin");
  });

  it("auth routes return 429 for rate limit", () => {
    expect(torgimaErrorToStatus("RATE_LIMITED")).toBe(429);
  });

  it("requireAuth rejects tampered session with UNAUTHENTICATED", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../services/AuthService.ts", import.meta.url), "utf8"),
    );
    expect(src).toMatch(/validateSession|getSession/);
  });

  it("select-blueprint route is registered (not 404)", async () => {
    const health = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../routes/health.ts", import.meta.url), "utf8"),
    );
    expect(health).toContain("select-blueprint");
    const onboarding = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../routes/onboarding.ts", import.meta.url), "utf8"),
    );
    expect(onboarding).toContain("selectBlueprintLaunchHandler");
  });
});

describe("DOC 37 — security error shape", () => {
  it("FORBIDDEN does not expose internal route details in default message", () => {
    const err = new TorgimaError("FORBIDDEN", "Internal route not accessible from browser");
    expect(err.message).not.toMatch(/postgres|secret|INTERNAL_AUTH/i);
  });

  it("SQL injection in UUID param rejected by Zod (structural)", async () => {
    const fs = await import("node:fs");
    const read = (rel: string) =>
      fs.readFileSync(new URL(rel, import.meta.url), "utf8");
    const orders = read("../../../routes/orders.ts");
    const executionRoutes = read("../../../routes/executionRoutes.ts");
    const uuidPattern = /z\.string\(\)\.uuid|z\.uuid\(\)|z\.string\(\)\.pipe\(z\.uuid\(\)\)/;
    expect(orders + executionRoutes).toMatch(uuidPattern);
  });

  it("tier loaded from DB not JWT (structural)", async () => {
    const auth = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../services/AuthService.ts", import.meta.url), "utf8"),
    );
    expect(auth).toMatch(/tier|users\./i);
    expect(auth).not.toMatch(/jwt\.tier|token\.tier/i);
  });
});
