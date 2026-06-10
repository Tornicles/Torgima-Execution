/**
 * CORS safety tests — verify that all response types carry Access-Control headers.
 *
 * These tests cover the three layers that guard CORS:
 *   1. isAllowedOrigin()         — allowlist gate
 *   2. applyCorsHeaders()        — used in the Express global error handler
 *   3. createCorsMiddleware()    — Express root middleware
 *
 * The worker-level CORS guard (workerErrorResponse) cannot be unit-tested here
 * because worker.ts imports `cloudflare:node`; it is verified by the production
 * curl checks in PHASE 8.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import {
  isAllowedOrigin,
  applyCorsHeaders,
  createCorsMiddleware,
} from "../../../lib/cors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: vi.fn((k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    }),
    end: vi.fn(),
    statusCode: 200,
    _headers: headers,
  } as unknown as Response & { _headers: Record<string, string> };
}

function mockReq(origin?: string, method = "GET") {
  return {
    headers: { origin },
    method,
  } as unknown as Request;
}

// ---------------------------------------------------------------------------
// isAllowedOrigin — production origins that MUST work
// ---------------------------------------------------------------------------

describe("isAllowedOrigin — production allowlist", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  it.each([
    "https://torgima.com",
    "https://www.torgima.com",
    "https://torgima-execution.pages.dev",
  ])("allows %s", (origin) => {
    expect(isAllowedOrigin(origin)).toBe(true);
  });

  it.each([
    "https://evil.com",
    "http://torgima.com",          // HTTP not HTTPS
    "https://torgima.com.evil.io",  // subdomain attack
    "",
    undefined,
    "null",
  ])("blocks %s", (origin) => {
    expect(isAllowedOrigin(origin as string | undefined)).toBe(false);
  });

  it("strips trailing slash before matching", () => {
    expect(isAllowedOrigin("https://torgima.com/")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyCorsHeaders — used by the Express global error handler in app.ts
// ---------------------------------------------------------------------------

describe("applyCorsHeaders — error handler usage", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  it("sets ACAO and credentials on allowed origin", () => {
    const req = mockReq("https://torgima.com");
    const res = mockRes();
    applyCorsHeaders(req, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "https://torgima.com",
    );
    expect(res.setHeader).toHaveBeenCalledWith("Access-Control-Allow-Credentials", "true");
  });

  it("sets ACAO for Pages preview origin", () => {
    const req = mockReq("https://torgima-execution.pages.dev");
    const res = mockRes();
    applyCorsHeaders(req, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "https://torgima-execution.pages.dev",
    );
  });

  it("does NOT set ACAO for unknown origin — never leaks CORS to bad actors", () => {
    const req = mockReq("https://attacker.example");
    const res = mockRes();
    applyCorsHeaders(req, res);
    const calls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.map(
      ([k]: [string]) => k.toLowerCase(),
    );
    expect(calls).not.toContain("access-control-allow-origin");
  });

  it("is a no-op when origin header is absent — server-to-server or cURL requests", () => {
    const req = mockReq(undefined);
    const res = mockRes();
    applyCorsHeaders(req, res);
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createCorsMiddleware — root Express middleware behavior
// ---------------------------------------------------------------------------

describe("createCorsMiddleware — headers on every request type", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  it("sets headers and calls next() for a normal GET from an allowed origin", () => {
    const mw = createCorsMiddleware();
    const req = mockReq("https://torgima.com", "GET");
    const res = mockRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "https://torgima.com",
    );
  });

  it("responds 204 to OPTIONS preflight and does NOT call next()", () => {
    const mw = createCorsMiddleware();
    const req = mockReq("https://torgima.com", "OPTIONS");
    const res = mockRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "https://torgima.com",
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Methods",
      expect.stringContaining("POST"),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Headers",
      expect.stringContaining("Authorization"),
    );
  });

  it("calls next() without setting ACAO for an unknown origin", () => {
    const mw = createCorsMiddleware();
    const req = mockReq("https://attacker.example", "GET");
    const res = mockRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    const headerKeys = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.map(
      ([k]: [string]) => k.toLowerCase(),
    );
    expect(headerKeys).not.toContain("access-control-allow-origin");
  });

  it("calls next() without setting ACAO when no Origin header is present", () => {
    const mw = createCorsMiddleware();
    const req = mockReq(undefined, "GET");
    const res = mockRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    const headerKeys = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.map(
      ([k]: [string]) => k.toLowerCase(),
    );
    expect(headerKeys).not.toContain("access-control-allow-origin");
  });
});

// ---------------------------------------------------------------------------
// Global error handler integration — applyCorsHeaders + handleError
// ---------------------------------------------------------------------------

describe("global error handler — CORS headers on Express errors", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  it("applyCorsHeaders is idempotent — calling it twice does not clear the header", () => {
    const req = mockReq("https://torgima.com");
    const res = mockRes();
    applyCorsHeaders(req, res);
    applyCorsHeaders(req, res);
    const acoaCalls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([k]: [string]) => k.toLowerCase() === "access-control-allow-origin",
    );
    // Last call should still set the correct value
    expect(acoaCalls.at(-1)?.[1]).toBe("https://torgima.com");
  });

  it("CORS header survives a subsequent setHeader call for a different header", () => {
    const req = mockReq("https://torgima.com");
    const res = mockRes();
    applyCorsHeaders(req, res);
    res.setHeader("Content-Type", "application/json");
    const corsValue = (res as unknown as { _headers: Record<string, string> })._headers[
      "access-control-allow-origin"
    ];
    expect(corsValue).toBe("https://torgima.com");
  });
});
