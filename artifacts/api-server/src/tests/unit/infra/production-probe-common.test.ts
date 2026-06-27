import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "../..");
const probeModuleUrl = pathToFileURL(resolve(root, "scripts/production-probe-common.mjs")).href;
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

async function loadProbeCommon() {
  return import(probeModuleUrl);
}

describe("production-probe-common health contract", () => {
  it("/health returns boolean true → liveness PASS", async () => {
    const { parseHealthLivenessResponse, FAILURE_CLASSES } = await loadProbeCommon();
    const result = parseHealthLivenessResponse(200, true);
    expect(result.ok).toBe(true);
    expect(result.class).toBe(FAILURE_CLASSES.CANONICAL_API_HEALTH_PASS);
  });

  it("/health returns { ok: true } → liveness PASS", async () => {
    const { parseHealthLivenessResponse, FAILURE_CLASSES } = await loadProbeCommon();
    const result = parseHealthLivenessResponse(200, { ok: true, status: "healthy" });
    expect(result.ok).toBe(true);
    expect(result.class).toBe(FAILURE_CLASSES.CANONICAL_API_HEALTH_PASS);
  });

  it("/health returns false → liveness FAIL", async () => {
    const { parseHealthLivenessResponse, FAILURE_CLASSES } = await loadProbeCommon();
    const result = parseHealthLivenessResponse(200, false);
    expect(result.ok).toBe(false);
    expect(result.class).toBe(FAILURE_CLASSES.CANONICAL_API_HEALTH_FAIL);
  });

  it("/health returns { ok: false } → liveness FAIL", async () => {
    const { parseHealthLivenessResponse, FAILURE_CLASSES } = await loadProbeCommon();
    const result = parseHealthLivenessResponse(200, { ok: false });
    expect(result.ok).toBe(false);
    expect(result.class).toBe(FAILURE_CLASSES.CANONICAL_API_HEALTH_FAIL);
  });

  it("debug route returns FORBIDDEN without header → expected classification", async () => {
    const { classifyDebugProbeFailure, FAILURE_CLASSES } = await loadProbeCommon();
    const body = { ok: false, error: { code: "FORBIDDEN", message: "Internal auth required" } };
    expect(classifyDebugProbeFailure(403, JSON.stringify(body), body)).toBe(
      FAILURE_CLASSES.INTERNAL_AUTH_SECRET_MISMATCH,
    );
  });

  it("workers.dev 404 → optional warning class", async () => {
    const { FAILURE_CLASSES } = await loadProbeCommon();
    expect(FAILURE_CLASSES.WORKERS_DEV_ROUTE_404_OPTIONAL).toBe("WORKERS_DEV_ROUTE_404_OPTIONAL");
  });

  it("/api/health ok:false → readiness FAIL (deployed but not ready)", async () => {
    const { parseApiHealthReadinessResponse, FAILURE_CLASSES } = await loadProbeCommon();
    const result = parseApiHealthReadinessResponse(200, {
      ok: false,
      status: "critical",
      failing: ["database"],
    });
    expect(result.ok).toBe(false);
    expect(result.class).toBe(FAILURE_CLASSES.CANONICAL_API_HEALTH_READINESS_FAIL);
  });

  it("/api/health ok:true + status healthy → readiness PASS", async () => {
    const { parseApiHealthReadinessResponse, FAILURE_CLASSES } = await loadProbeCommon();
    const result = parseApiHealthReadinessResponse(200, { ok: true, status: "healthy" });
    expect(result.ok).toBe(true);
    expect(result.class).toBe(FAILURE_CLASSES.CANONICAL_API_HEALTH_READINESS_PASS);
  });

  it("missing INTERNAL_AUTH_SECRET → readiness probe fails clearly", async () => {
    const { probeApiHealthReadiness, FAILURE_CLASSES } = await loadProbeCommon();
    const result = await probeApiHealthReadiness("https://api.torgima.com", "");
    expect(result.ok).toBe(false);
    expect(result.class).toBe(FAILURE_CLASSES.INTERNAL_AUTH_SECRET_MISSING);
  });
});

describe("production-deploy-verify deploy-only contract", () => {
  it("skips /api/health readiness gate when --deploy-only", () => {
    const script = readRepo("scripts/production-deploy-verify.mjs");
    expect(script).toContain("--deploy-only");
    expect(script).toContain("if (!deployOnly) {");
    expect(script).toContain("probeApiHealthReadiness");
    expect(script).toContain("let readiness = null");
  });

  it("fails full readiness when /api/health is not healthy", () => {
    const script = readRepo("scripts/production-deploy-verify.mjs");
    expect(script).toContain("CANONICAL_API_HEALTH_READINESS_FAIL");
    expect(script).toContain("if (!deployOnly && readiness && !readiness.ok)");
  });

  it("exports parseHealthLivenessResponse in probe module", () => {
    const probeCommon = readRepo("scripts/production-probe-common.mjs");
    expect(probeCommon).toContain("parseHealthLivenessResponse");
    expect(probeCommon).toContain("body === true");
  });
});
