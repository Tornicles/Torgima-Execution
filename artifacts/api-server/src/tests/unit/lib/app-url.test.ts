import { afterEach, describe, expect, it } from "vitest";
import { resolveAppUrl } from "../../../lib/app-url.js";

describe("resolveAppUrl", () => {
  const keys = ["FRONTEND_URL", "APP_URL", "PUBLIC_APP_URL", "NEXT_PUBLIC_APP_URL"] as const;
  const env = { ...process.env };

  afterEach(() => {
    process.env = env;
    for (const k of keys) delete process.env[k];
  });

  it("returns hardwired Vercel URL in production", () => {
    process.env.NODE_ENV = "production";
    expect(resolveAppUrl()).toBe("https://torgima-execution.vercel.app");
  });

  it("prefers FRONTEND_URL over APP_URL in development", () => {
    process.env.NODE_ENV = "development";
    process.env.FRONTEND_URL = "https://torgima-execution.vercel.app";
    process.env.APP_URL = "https://torgima.com";
    expect(resolveAppUrl()).toBe("https://torgima-execution.vercel.app");
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
