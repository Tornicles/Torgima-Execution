import { afterEach, describe, expect, it } from "vitest";
import { buildMagicLinkVerifyUrl, resolveApiPublicUrl } from "../../../lib/api-url.js";

describe("api-url", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("builds Vercel callback URLs with encoded email", () => {
    process.env.APP_URL = "https://torgima-execution.vercel.app";
    process.env.NODE_ENV = "production";
    const url = buildMagicLinkVerifyUrl("raw-token", "user@example.com");
    expect(url).toBe(
      "https://torgima-execution.vercel.app/auth/callback?token=raw-token&email=user%40example.com",
    );
  });

  it("uses production backend when no override is set", () => {
    delete process.env.API_PUBLIC_URL;
    delete process.env.PUBLIC_API_URL;
    process.env.NODE_ENV = "production";
    expect(resolveApiPublicUrl()).toBe(
      "https://workspaceapi-server-production-63b3.up.railway.app",
    );
  });
});
