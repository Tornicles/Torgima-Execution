/**
 * Upgrade-status route and service safety tests.
 *
 * Verifies that:
 *  - /api/upgrade/status NEVER returns 500 (safe defaults on any error).
 *  - PlatformUpgradeService wraps archive/migration queries in try-catch.
 *  - handleError applies CORS headers before sending any error response.
 *  - worker.ts intercepts responses and injects CORS headers if absent.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

// ---------------------------------------------------------------------------
// /api/upgrade/status route — must never propagate 500
// ---------------------------------------------------------------------------

describe("/api/upgrade/status route — safe-default contract", () => {
  const src = read("artifacts/api-server/src/routes/upgrade.ts");

  it("defines UPGRADE_SAFE_DEFAULT constant with all required fields", () => {
    expect(src).toContain("UPGRADE_SAFE_DEFAULT");
    expect(src).toContain("requiresUpgrade: false");
    expect(src).toContain("executionState: \"NORMAL\"");
    expect(src).toContain("firstLoginAfterUpgrade: false");
    expect(src).toContain("archivedCounts: {}");
    expect(src).toContain("migrationApplied: true");
  });

  it("uses OPTIONAL_SESSION for the status route (USER_SESSION allowed in other routes)", () => {
    // Confirm the status route handler itself calls requireAuth with OPTIONAL_SESSION.
    // Other routes (/upgrade/archived, /upgrade/acknowledge) may still use USER_SESSION.
    const statusRouteStart = src.indexOf('router.get("/upgrade/status"');
    const statusRouteEnd = src.indexOf('router.get("/upgrade/archived"');
    expect(statusRouteStart).toBeGreaterThan(-1);
    const statusBlock = src.slice(statusRouteStart, statusRouteEnd > 0 ? statusRouteEnd : undefined);
    expect(statusBlock).toContain('"OPTIONAL_SESSION"');
    expect(statusBlock).not.toContain('"USER_SESSION"');
  });

  it("returns safe default for unauthenticated requests (!auth.userId)", () => {
    expect(src).toContain("!auth.userId");
    // The success call immediately after the auth check must use UPGRADE_SAFE_DEFAULT
    const unauthBlock = src.slice(src.indexOf("!auth.userId"), src.indexOf("!auth.userId") + 200);
    expect(unauthBlock).toContain("UPGRADE_SAFE_DEFAULT");
  });

  it("catch block returns success with safe defaults instead of calling handleError", () => {
    const catchIdx = src.indexOf("} catch (err)");
    expect(catchIdx).toBeGreaterThan(-1);
    // Use a large window — the success call comes after the logger.warn()
    const catchBlock = src.slice(catchIdx, catchIdx + 600);
    // Must call success() in catch — not handleError()
    expect(catchBlock).toContain("success(res, UPGRADE_SAFE_DEFAULT)");
    expect(catchBlock).not.toContain("handleError(req, res, err)");
  });

  it("logs the suppressed error for observability", () => {
    const catchIdx = src.indexOf("} catch (err)");
    const catchBlock = src.slice(catchIdx, catchIdx + 300);
    expect(catchBlock).toMatch(/logger\.(warn|error)/);
  });
});

// ---------------------------------------------------------------------------
// PlatformUpgradeService — defensive DB queries
// ---------------------------------------------------------------------------

describe("PlatformUpgradeService.getStatus — defensive archive/migration queries", () => {
  const src = read("artifacts/api-server/src/services/PlatformUpgradeService.ts");

  it("wraps archive query in try-catch so a missing table does not throw", () => {
    const archiveIdx = src.indexOf("platform_upgrade_archive");
    expect(archiveIdx).toBeGreaterThan(-1);
    // Ensure a try block wraps the archive SQL
    const beforeArchive = src.slice(Math.max(0, archiveIdx - 200), archiveIdx);
    expect(beforeArchive).toMatch(/try\s*\{/);
    // Ensure there is a catch block after the archive SQL
    const afterArchive = src.slice(archiveIdx, archiveIdx + 400);
    expect(afterArchive).toContain("} catch");
  });

  it("wraps migration query in try-catch so a missing table does not throw", () => {
    const migIdx = src.indexOf("platform_upgrade_migrations");
    expect(migIdx).toBeGreaterThan(-1);
    const beforeMig = src.slice(Math.max(0, migIdx - 200), migIdx);
    expect(beforeMig).toMatch(/try\s*\{/);
    const afterMig = src.slice(migIdx, migIdx + 400);
    expect(afterMig).toContain("} catch");
  });

  it("initialises archivedCounts to empty object before the try block", () => {
    const beforeArchive = src.slice(0, src.indexOf("platform_upgrade_archive"));
    expect(beforeArchive).toContain("archivedCounts: Record<string, number> = {}");
  });

  it("initialises migrationApplied to false before the try block", () => {
    const beforeMig = src.slice(0, src.indexOf("platform_upgrade_migrations"));
    expect(beforeMig).toContain("migrationApplied = false");
  });
});

// ---------------------------------------------------------------------------
// handleError — must call applyCorsHeaders before every error response
// ---------------------------------------------------------------------------

describe("handleError — CORS on all error responses", () => {
  const src = read("artifacts/api-server/src/lib/utils.ts");

  it("imports applyCorsHeaders from cors.js", () => {
    expect(src).toMatch(/import\s+\{[^}]*applyCorsHeaders[^}]*\}\s+from\s+['"]\.\/cors\.js['"]/);
  });

  it("calls applyCorsHeaders(req, res) at the start of handleError", () => {
    const fnIdx = src.indexOf("export function handleError");
    expect(fnIdx).toBeGreaterThan(-1);
    // Use a large window — the first failure() call is deep inside the function body
    const fnBody = src.slice(fnIdx, fnIdx + 1200);
    const applyIdx = fnBody.indexOf("applyCorsHeaders(req, res)");
    const firstFailureIdx = fnBody.indexOf("failure(");
    // Both must be found, and applyCorsHeaders must come first
    expect(applyIdx).toBeGreaterThan(-1);
    expect(firstFailureIdx).toBeGreaterThan(-1);
    expect(applyIdx).toBeLessThan(firstFailureIdx);
  });
});

// ---------------------------------------------------------------------------
// worker.ts — CORS intercept for all Express responses
// ---------------------------------------------------------------------------

describe("worker.ts — CORS header intercept on every response", () => {
  const src = read("artifacts/api-server/src/worker.ts");

  it("intercepts the response from the handler before returning to browser", () => {
    expect(src).toContain("const response = await handler(request, env, ctx)");
  });

  it("checks for missing Access-Control-Allow-Origin header", () => {
    expect(src).toContain('!response.headers.get("Access-Control-Allow-Origin")');
  });

  it("creates a new patched response with CORS headers injected", () => {
    expect(src).toContain("const patchedHeaders = new Headers(response.headers)");
    expect(src).toContain('patchedHeaders.set("Access-Control-Allow-Origin", origin)');
    expect(src).toContain('patchedHeaders.set("Access-Control-Allow-Credentials", "true")');
  });

  it("only injects CORS headers for allowed origins", () => {
    expect(src).toContain("isAllowedOrigin(origin)");
  });

  it("returns original response unchanged when CORS header already present", () => {
    // The condition checks for MISSING header — if present, we fall through to return response
    const interceptIdx = src.indexOf("const patchedHeaders");
    const returnOrigIdx = src.indexOf("return response;", interceptIdx);
    // There must be a return response; after the patch block (for when no patch needed)
    expect(returnOrigIdx).toBeGreaterThan(-1);
  });
});

// ---------------------------------------------------------------------------
// app.ts global error handler — applyCorsHeaders + handleError
// ---------------------------------------------------------------------------

describe("app.ts — global Express error handler applies CORS", () => {
  const src = read("artifacts/api-server/src/app.ts");

  it("registers a 4-argument Express error handler after all routes", () => {
    const routeIdx = src.lastIndexOf('app.use("/api"');
    const errorHandlerIdx = src.indexOf("(err: Error, req: Request, res: Response, _next: NextFunction)", routeIdx);
    expect(errorHandlerIdx).toBeGreaterThan(routeIdx);
  });

  it("calls applyCorsHeaders inside the global error handler", () => {
    const handlerIdx = src.indexOf("(err: Error, req: Request, res: Response, _next: NextFunction)");
    const handlerBody = src.slice(handlerIdx, handlerIdx + 300);
    expect(handlerBody).toContain("applyCorsHeaders(req, res)");
    expect(handlerBody).toContain("handleError(req, res, err)");
  });
});
