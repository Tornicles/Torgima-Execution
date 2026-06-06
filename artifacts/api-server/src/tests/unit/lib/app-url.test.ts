import { afterEach, describe, expect, it } from "vitest";
import { resolveAppUrl } from "../../../lib/app-url.js";

describe("resolveAppUrl", () => {
  const keys = ["FRONTEND_URL", "APP_URL", "PUBLIC_APP_URL", "NEXT_PUBLIC_APP_URL"] as const;
  const env = { ...process.env };

  afterEach(() => {
    process.env = env;
    for (const k of keys) delete process.env[k];
  });

  it("prefers APP_URL in production when set (DOC 30)", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "https://my-app.vercel.app/";
    expect(resolveAppUrl()).toBe("https://my-app.vercel.app");
  });

  it("falls back to production frontend URL without APP_URL", () => {
    process.env.NODE_ENV = "production";
    delete process.env.APP_URL;
    expect(resolveAppUrl()).toBe("https://torgima-frontend.pages.dev");
  });

  it("prefers APP_URL when set in development (DOC 30)", () => {
    process.env.NODE_ENV = "development";
    process.env.FRONTEND_URL = "https://torgima-execution.vercel.app";
    process.env.APP_URL = "https://torgima.com";
    expect(resolveAppUrl()).toBe("https://torgima.com");
  });

  it("uses first comma-separated FRONTEND_URL entry in development", () => {
    process.env.NODE_ENV = "development";
    process.env.FRONTEND_URL =
      "https://torgima-execution.vercel.app,https://torgima.com";
    expect(resolveAppUrl()).toBe("https://torgima-execution.vercel.app");
  });

  it("strips trailing slash in development", () => {
    process.env.NODE_ENV = "development";
    process.env.FRONTEND_URL = "https://app.example.com/";
    expect(resolveAppUrl()).toBe("https://app.example.com");
  });
});
