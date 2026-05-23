import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAllowedOrigins, isAllowedOrigin } from "../../../lib/cors.js";

describe("CORS allowlist", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = env;
  });

  beforeEach(() => {
    delete process.env.FRONTEND_URL;
    process.env.NODE_ENV = "production";
  });

  it("allows the production Vercel SPA origin", () => {
    expect(isAllowedOrigin("https://torgima-execution.vercel.app")).toBe(true);
    expect(getAllowedOrigins()).toContain("https://torgima-execution.vercel.app");
  });

  it("allows comma-separated FRONTEND_URL entries", () => {
    process.env.FRONTEND_URL = "https://preview.vercel.app/,https://torgima.com/";
    expect(isAllowedOrigin("https://preview.vercel.app")).toBe(true);
    expect(isAllowedOrigin("https://torgima.com")).toBe(true);
  });

  it("allows other *.vercel.app preview deployments", () => {
    expect(isAllowedOrigin("https://torgima-git-main-tornicles.vercel.app")).toBe(true);
  });

  it("rejects unknown origins", () => {
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
  });
});
