import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("DOC 30 — Authentication & Session Management", () => {
  it("validates production auth env on boot", () => {
    const index = readRepo("artifacts/api-server/src/index.ts");
    expect(index).toContain("assertAuthEnvOnBoot");
  });

  it("uses magic_link_tokens and 15-minute expiry in AuthService", () => {
    const auth = readRepo("artifacts/api-server/src/services/AuthService.ts");
    expect(auth).toContain("magicLinkTokens");
    expect(auth).toContain("MAGIC_LINK_EXPIRY_MINUTES = 15");
    expect(auth).toContain("SESSION_IDLE_MS");
  });

  it("resolves APP_URL for magic links", () => {
    const appUrl = readRepo("artifacts/api-server/src/lib/app-url.ts");
    expect(appUrl).toContain('process.env["APP_URL"]');
  });

  it("registers session cleanup worker at 02:00 UTC", () => {
    const worker = readRepo("artifacts/api-server/src/workers/SessionCleanupWorker.ts");
    expect(worker).toContain("0 2 * * *");
    expect(worker).toContain("session-cleanup");
    const start = readRepo("artifacts/api-server/src/workers/start.ts");
    expect(start).toContain("SessionCleanupWorker");
    expect(start).toContain("startSessionCleanupSchedule");
  });

  it("logs browser internal route attempts", () => {
    const authLib = readRepo("artifacts/api-server/src/lib/auth.ts");
    expect(authLib).toContain("BROWSER_INTERNAL_ROUTE_ATTEMPT");
    expect(authLib).toContain("logAuthSecurityEvent");
  });

  it("exposes ownership guard helpers", () => {
    const guards = readRepo("artifacts/api-server/src/lib/ownership-guards.ts");
    expect(guards).toContain("requireBlueprintOwnership");
    expect(guards).toContain("requireOrderOwnership");
    expect(guards).toContain("requireFeedbackOwnership");
  });

  it("returns sessionExpired on auth errors", () => {
    const utils = readRepo("artifacts/api-server/src/lib/utils.ts");
    expect(utils).toContain("sessionExpired");
  });
});
