import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getAllowedOrigins, isAllowedOrigin, createCorsMiddleware } from "../../../lib/cors.js";
import type { Request, Response } from "express";

describe("CORS allowlist", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = env;
  });

  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  it("allows production SPA origins (torgima.com + Vercel transition)", () => {
    expect(isAllowedOrigin("https://torgima.com")).toBe(true);
    expect(isAllowedOrigin("https://torgima-execution.vercel.app")).toBe(true);
    expect(getAllowedOrigins()).toContain("https://torgima.com");
    expect(getAllowedOrigins()).toContain("https://torgima-execution.vercel.app");
  });

  it("rejects preview and unknown origins in production", () => {
    expect(isAllowedOrigin("https://torgima-git-main-tornicles.vercel.app")).toBe(false);
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
  });
});

describe("CORS allowlist (development)", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = env;
  });

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  it("allows localhost in development", () => {
    expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
  });
});

describe("createCorsMiddleware", () => {
  function makeRes() {
    const headers: Record<string, string> = {};
    return {
      setHeader: vi.fn((k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      }),
      end: vi.fn(),
      statusCode: 200,
      headers,
    } as unknown as Response;
  }

  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  it("sets ACAO and credentials for an allowed origin on GET", () => {
    const middleware = createCorsMiddleware();
    const req = {
      headers: { origin: "https://torgima-execution.vercel.app" },
      method: "GET",
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "https://torgima-execution.vercel.app",
    );
    expect(res.setHeader).toHaveBeenCalledWith("Access-Control-Allow-Credentials", "true");
  });

  it("responds 204 immediately for OPTIONS preflight and includes all required headers", () => {
    const middleware = createCorsMiddleware();
    const req = {
      headers: { origin: "https://torgima-execution.vercel.app" },
      method: "OPTIONS",
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "https://torgima-execution.vercel.app",
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Methods",
      expect.stringContaining("POST"),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Headers",
      expect.stringContaining("Content-Type"),
    );
  });

  it("does not set ACAO for an unknown origin", () => {
    const middleware = createCorsMiddleware();
    const req = { headers: { origin: "https://evil.example" }, method: "GET" } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    const calls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.map(([k]: [string]) =>
      k.toLowerCase(),
    );
    expect(calls).not.toContain("access-control-allow-origin");
  });
});
