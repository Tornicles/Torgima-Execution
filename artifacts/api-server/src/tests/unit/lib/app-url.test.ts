import { afterEach, describe, expect, it } from "vitest";
import { resolveAppUrl } from "../../../lib/app-url.js";

describe("resolveAppUrl", () => {
  const keys = ["FRONTEND_URL", "APP_URL", "PUBLIC_APP_URL", "NEXT_PUBLIC_APP_URL"] as const;

  afterEach(() => {
    for (const k of keys) delete process.env[k];
  });

  it("prefers FRONTEND_URL over APP_URL (magic links must match SPA origin)", () => {
    process.env.FRONTEND_URL = "https://torgima-execution.vercel.app";
    process.env.APP_URL = "https://torgima.com";
    expect(resolveAppUrl()).toBe("https://torgima-execution.vercel.app");
  });

  it("uses first comma-separated FRONTEND_URL entry", () => {
    process.env.FRONTEND_URL =
      "https://torgima-execution.vercel.app,https://torgima.com";
    expect(resolveAppUrl()).toBe("https://torgima-execution.vercel.app");
  });

  it("strips trailing slash", () => {
    process.env.FRONTEND_URL = "https://app.example.com/";
    expect(resolveAppUrl()).toBe("https://app.example.com");
  });
});
