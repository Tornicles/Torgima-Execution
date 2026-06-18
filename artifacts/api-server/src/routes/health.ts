import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { executeHealthSql } from "@workspace/db";
import { success, handleError } from "../lib/utils.js";
import { requireAuth } from "../lib/auth.js";
import { getUserFacingHealthState } from "../services/SystemHealthService.js";
import { verifyBlueprintLaunchSchema, verifyOnboardingSchema } from "../lib/verifySchema.js";
import { isCloudflareRuntime } from "../lib/cloudflare-runtime.js";
import { extractInternalToken, getInternalAuthSecret } from "../lib/security/internalAuth.js";
import {
  buildSafeDatabaseTargetSnapshot,
} from "../lib/databaseTargetDebug.js";
import {
  probeWorkerDatabaseConnection,
  probeWorkerSignalRecency,
} from "../lib/workerDatabaseHealth.js";
import { DOC29_KEY_API_ROUTES } from "../lib/doc29-route-inventory.js";

const router: IRouter = Router();

type HealthCheckDetail = {
  ok: boolean;
  detail: string;
  error_name?: string;
  error_code?: string | null;
  error_message_safe?: string;
  error_class?: string;
  driver?: string;
  runtime?: string;
  host?: string | null;
  port?: string | null;
  ssl?: boolean;
  elapsedMs?: number;
};

const HEALTH_CHECK_TIMEOUT_MS = isCloudflareRuntime() ? 18_000 : 8_000;

async function runHealthCheck(
  name: string,
  fn: () => Promise<string>,
): Promise<HealthCheckDetail> {
  try {
    const detail = await Promise.race([
      fn(),
      new Promise<string>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${name} timed out after ${HEALTH_CHECK_TIMEOUT_MS / 1000}s`)),
          HEALTH_CHECK_TIMEOUT_MS,
        ),
      ),
    ]);
    return { ok: true, detail };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function healthQuery<T extends Record<string, unknown>>(
  queryText: string,
  values?: unknown[],
): Promise<T[]> {
  return executeHealthSql<T>(queryText, values);
}

async function runDatabaseHealthCheck(): Promise<HealthCheckDetail> {
  if (!envValue("DATABASE_URL")) {
    return { ok: false, detail: "DATABASE_URL not set" };
  }
  return probeWorkerDatabaseConnection();
}

function envValue(key: string): string | undefined {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildEnvAndBindingChecks(): Record<string, HealthCheckDetail> {
  const requiredEnvVars = [
    "DATABASE_URL",
    "ANTHROPIC_API_KEY",
    "RESEND_API_KEY",
    "INTERNAL_AUTH_SECRET",
  ] as const;

  const missingVars: string[] = [];
  const presentVars: string[] = [];

  for (const key of requiredEnvVars) {
    if (envValue(key)) {
      presentVars.push(key);
    } else {
      missingVars.push(key);
    }
  }

  const dbUrl = envValue("DATABASE_URL") ?? "";
  const databaseUrl: HealthCheckDetail = !dbUrl
    ? { ok: false, detail: "DATABASE_URL is not set" }
    : dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://")
      ? { ok: true, detail: "postgres URL present" }
      : { ok: false, detail: "DATABASE_URL format invalid (expected postgresql:// or postgres://)" };

  const kv = globalThis.__TORGIMA_SESSIONS_KV__;
  const kvCheck: HealthCheckDetail = kv
    ? { ok: true, detail: "SESSIONS KV binding present" }
    : { ok: false, detail: "SESSIONS KV binding not found in env" };

  return {
    env_vars:
      missingVars.length === 0
        ? { ok: true, detail: `All ${presentVars.length} required vars present` }
        : { ok: false, detail: `Missing: ${missingVars.join(", ")}` },
    database_url: databaseUrl,
    anthropic: envValue("ANTHROPIC_API_KEY")
      ? { ok: true, detail: "ANTHROPIC_API_KEY present" }
      : { ok: false, detail: "ANTHROPIC_API_KEY not set" },
    resend: envValue("RESEND_API_KEY")
      ? { ok: true, detail: "RESEND_API_KEY present" }
      : { ok: false, detail: "RESEND_API_KEY not set" },
    kv: kvCheck,
    runtime: {
      ok: true,
      detail: `${isCloudflareRuntime() ? "cloudflare-workers" : "node"} | ${new Date().toISOString()}`,
    },
  };
}

async function verifyKvReadWrite(): Promise<HealthCheckDetail> {
  const kv = globalThis.__TORGIMA_SESSIONS_KV__;
  if (!kv) {
    return { ok: false, detail: "SESSIONS KV binding not found in env" };
  }
  try {
    await kv.put("__health_check__", "ok", { expirationTtl: 60 });
    const val = await kv.get("__health_check__");
    return val === "ok"
      ? { ok: true, detail: "KV read/write succeeded" }
      : { ok: false, detail: `KV write succeeded but read returned: ${val}` };
  } catch (err) {
    return {
      ok: false,
      detail: `KV error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export type ProductionHealthCheck = "ok" | "error";

export interface ProductionHealthResponse {
  status: "healthy" | "degraded";
  timestamp: string;
  checks: {
    database: ProductionHealthCheck;
    bhudhi: ProductionHealthCheck;
    workers: ProductionHealthCheck;
    signals: ProductionHealthCheck;
  };
  version: string;
  metrics: {
    pendingEvents: number | null;
    deadLetters: number | null;
    healthIssues: number | null;
    latestSignalAgeHours: number | null;
  };
}

export async function checkDatabaseConnection(): Promise<void> {
  await healthQuery("SELECT 1 AS ping");
}

export async function checkBhudhiAPIAvailability(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  if (process.env.NODE_ENV === "production" && !apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required in production");
  }
}

export async function checkPgBossWorkers(): Promise<void> {
  if (isCloudflareRuntime()) {
    return;
  }
  const rows = await healthQuery<{ job_table: string | null }>(
    "SELECT to_regclass('pgboss.job') AS job_table",
  );
  if (!rows[0]?.job_table) {
    throw new Error("pg-boss job table not found");
  }
}

export async function checkSignalEngineRecency(maxAgeHours = 48): Promise<number | null> {
  const rows = await healthQuery<{ active: number | string; latest: Date | string | null }>(
    `SELECT
      (SELECT COUNT(*)::int FROM blueprints WHERE active = true AND status = 'active') AS active,
      (SELECT MAX(created_at) FROM signal_snapshots) AS latest`,
  );
  const activeBlueprints = Number(rows[0]?.active ?? 0);
  if (activeBlueprints === 0) {
    return null;
  }

  const latest = rows[0]?.latest;
  if (!latest) {
    throw new Error("no signal snapshots while active blueprints exist");
  }

  const ageHours = (Date.now() - new Date(latest).getTime()) / (60 * 60 * 1000);
  if (ageHours > maxAgeHours) {
    throw new Error(`latest signal snapshot is stale: ${ageHours.toFixed(1)}h`);
  }
  return ageHours;
}

async function collectProductionMetrics(): Promise<ProductionHealthResponse["metrics"]> {
  const [pendingR, dlR, healthR, signalR] = await Promise.all([
    healthQuery<{ c: number | string }>(
      "SELECT COUNT(*)::int AS c FROM events WHERE status = 'pending'",
    ).catch(() => null),
    healthQuery<{ c: number | string }>(
      "SELECT COUNT(*)::int AS c FROM dead_letter_events WHERE resolved = false",
    ).catch(() => null),
    healthQuery<{ c: number | string }>(
      "SELECT COUNT(*)::int AS c FROM system_health_records WHERE health_score < 0.7",
    ).catch(() => null),
    healthQuery<{ latest: Date | string | null }>(
      "SELECT MAX(created_at) AS latest FROM signal_snapshots",
    ).catch(() => null),
  ]);

  const latest = signalR?.[0]?.latest;
  return {
    pendingEvents: pendingR ? Number(pendingR[0]?.c ?? 0) : null,
    deadLetters: dlR ? Number(dlR[0]?.c ?? 0) : null,
    healthIssues: healthR ? Number(healthR[0]?.c ?? 0) : null,
    latestSignalAgeHours: latest
      ? Number(((Date.now() - new Date(latest).getTime()) / (60 * 60 * 1000)).toFixed(2))
      : null,
  };
}

export async function buildProductionHealthResponse(): Promise<ProductionHealthResponse> {
  const healthChecks = await Promise.allSettled([
    checkDatabaseConnection(),
    checkBhudhiAPIAvailability(),
    checkPgBossWorkers(),
    checkSignalEngineRecency(),
  ]);

  const checks: ProductionHealthResponse["checks"] = {
    database: healthChecks[0]?.status === "fulfilled" ? "ok" : "error",
    bhudhi: healthChecks[1]?.status === "fulfilled" ? "ok" : "error",
    workers: healthChecks[2]?.status === "fulfilled" ? "ok" : "error",
    signals: healthChecks[3]?.status === "fulfilled" ? "ok" : "error",
  };
  const coreOk =
    checks.database === "ok" && checks.bhudhi === "ok" && checks.workers === "ok";
  const healthy = coreOk && checks.signals === "ok";

  let metrics: ProductionHealthResponse["metrics"] = {
    pendingEvents: null,
    deadLetters: null,
    healthIssues: null,
    latestSignalAgeHours: null,
  };
  try {
    metrics = await collectProductionMetrics();
  } catch {
    /* metrics are optional when DB is unavailable */
  }

  return {
    status: healthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.APP_VERSION ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "phase1",
    metrics,
  };
}

async function buildTransparentHealthPayload(): Promise<{
  results: ProductionHealthResponse;
  checks: Record<string, HealthCheckDetail>;
  failing: Array<{ check: string; detail: string }>;
  httpStatus: number;
  status: "healthy" | "degraded" | "critical";
}> {
  const checks: Record<string, HealthCheckDetail> = {};
  const workerRuntime = isCloudflareRuntime();

  checks.runtime = {
    ok: true,
    detail: `${workerRuntime ? "cloudflare-workers" : "node"} | ${new Date().toISOString()}`,
  };

  checks.env_vars = await runHealthCheck("env_vars", async () => {
    const required = [
      "DATABASE_URL",
      "ANTHROPIC_API_KEY",
      "RESEND_API_KEY",
      "INTERNAL_AUTH_SECRET",
    ] as const;
    const missing = required.filter((key) => !envValue(key));
    if (missing.length > 0) {
      throw new Error(`Missing secrets: ${missing.join(", ")}`);
    }
    return `All ${required.length} secrets present`;
  });

  const envChecks = buildEnvAndBindingChecks();
  checks.database_url = envChecks.database_url;
  checks.anthropic = envChecks.anthropic;
  checks.resend = envChecks.resend;

  checks.database = await runDatabaseHealthCheck();

  checks.bhudhi = await runHealthCheck("bhudhi", async () => {
    await checkBhudhiAPIAvailability();
    return "ANTHROPIC_API_KEY available";
  });

  checks.workers = workerRuntime
    ? { ok: true, detail: "Cloudflare Workers runtime (pg-boss not used)" }
    : await runHealthCheck("workers", async () => {
        await checkPgBossWorkers();
        return "pg-boss workers OK";
      });

  if (checks.database.ok) {
    if (workerRuntime) {
      const signalProbe = await probeWorkerSignalRecency();
      checks.signals = {
        ok: signalProbe.ok,
        detail: signalProbe.detail,
      };
    } else {
      checks.signals = await runHealthCheck("signals", async () => {
        const age = await checkSignalEngineRecency();
        return age == null ? "No active blueprints — skipped" : `Latest signal ${age.toFixed(1)}h ago`;
      });
    }
  } else {
    checks.signals = { ok: false, detail: "skipped — database check failed" };
  }

  // KV read/write costs subrequests on Workers — verify binding only in deep health.
  checks.kv = workerRuntime
    ? globalThis.__TORGIMA_SESSIONS_KV__
      ? { ok: true, detail: "SESSIONS KV binding present" }
      : { ok: false, detail: "SESSIONS KV binding not found in env" }
    : await verifyKvReadWrite();

  const productionChecks: ProductionHealthResponse["checks"] = {
    database: checks.database.ok ? "ok" : "error",
    bhudhi: checks.bhudhi.ok ? "ok" : "error",
    workers: checks.workers.ok ? "ok" : "error",
    signals: checks.signals.ok ? "ok" : "error",
  };

  const results: ProductionHealthResponse = {
    status:
      productionChecks.database === "ok" &&
      productionChecks.bhudhi === "ok" &&
      productionChecks.workers === "ok" &&
      productionChecks.signals === "ok"
        ? "healthy"
        : "degraded",
    timestamp: new Date().toISOString(),
    checks: productionChecks,
    version: process.env.APP_VERSION ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "phase1",
    metrics: workerRuntime
      ? {
          pendingEvents: null,
          deadLetters: null,
          healthIssues: null,
          latestSignalAgeHours: null,
        }
      : await collectProductionMetrics().catch(() => ({
          pendingEvents: null,
          deadLetters: null,
          healthIssues: null,
          latestSignalAgeHours: null,
        })),
  };

  const criticalChecks = ["database", "database_url", "env_vars"];
  const criticalFailed = criticalChecks.filter((key) => !checks[key]?.ok);
  const allOk = Object.values(checks).every((entry) => entry.ok);
  const status: "healthy" | "degraded" | "critical" = allOk
    ? "healthy"
    : criticalFailed.length > 0
      ? "critical"
      : "degraded";

  const httpStatus = status === "critical" ? 503 : 200;

  return {
    results: { ...results, status: status === "healthy" ? "healthy" : "degraded" },
    checks,
    failing: Object.entries(checks)
      .filter(([, entry]) => !entry.ok)
      .map(([check, entry]) => ({ check, detail: entry.detail })),
    httpStatus,
    status,
  };
}

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// GET /api/health — deep readiness (DB + signals + bindings). Requires internal auth on
// Cloudflare Workers; unauthenticated callers receive a liveness-only stub.
router.get("/health", async (req, res) => {
  const secret = getInternalAuthSecret();
  const token = extractInternalToken(req);
  const isInternal = secret.length > 0 && token === secret;

  if (isCloudflareRuntime() && !isInternal) {
    res.status(200).json({
      ok: true,
      status: "operational",
      readiness: "liveness_only",
      timestamp: new Date().toISOString(),
      service: "torgima-api",
      runtime: "cloudflare-workers",
      version: process.env.APP_VERSION ?? "phase1",
      hint: "Deep readiness requires x-internal-auth — use GET /api/health with INTERNAL_AUTH_SECRET",
      databaseTarget: buildSafeDatabaseTargetSnapshot(process.env.DATABASE_URL),
    });
    return;
  }

  try {
    const { results, checks, failing, httpStatus, status } = await buildTransparentHealthPayload();
    res.status(httpStatus).json({
      ok: status === "healthy",
      status,
      readiness: "deep",
      timestamp: results.timestamp,
      service: "torgima-api",
      runtime: isCloudflareRuntime() ? "cloudflare-workers" : "node",
      version: results.version,
      databaseTarget: buildSafeDatabaseTargetSnapshot(process.env.DATABASE_URL),
      checks,
      ...(failing.length > 0 ? { failing } : {}),
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      status: "critical",
      timestamp: new Date().toISOString(),
      service: "torgima-api",
      runtime: isCloudflareRuntime() ? "cloudflare-workers" : "node",
      checks: {
        route: {
          ok: false,
          detail: err instanceof Error ? err.message : "health handler error",
        },
      },
    });
  }
});

// Prompt 37 — metrics bundle for monitoring dashboard (platform + Bhudhi)
router.get("/metrics", async (req, res) => {
  try {
    const { collectBhudhiMetrics } = await import("../monitoring/metricsCollector.js");
    const metrics = await collectBhudhiMetrics();
    res.status(200).json(metrics);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/health/current — user-safe, never reveals internal failure detail.
router.get("/health/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const health = await getUserFacingHealthState(auth.userId);
    success(res, health);
  } catch {
    success(res, { systemOperational: true, executionAvailable: true });
  }
});

// GET /api/health/schema — onboarding-critical schema (public, for deploy checks)
router.get("/health/schema", async (_req, res) => {
  try {
    const onboarding = await verifyOnboardingSchema();
    const launch = await verifyBlueprintLaunchSchema();
    const ok = onboarding.ok && launch.ok;
    success(res, {
      ok,
      onboarding,
      launch,
      hint: ok
        ? "Schema ready for onboarding and blueprint launch"
        : "Run Drizzle migrations with: pnpm -F @workspace/db migrate",
    }, ok ? 200 : 503);
  } catch (err) {
    handleError(_req, res, err);
  }
});

const KEY_API_ROUTES = [
  ...DOC29_KEY_API_ROUTES,
  "POST /api/auth/send-magic-link",
  "POST /api/v1/onboarding/select-blueprint",
  "GET /api/blueprints/:id/tier-preview",
  "GET /api/blueprints/:id/versions",
  "POST /api/validation/run",
  "POST /api/v1/validation/run",
  "GET /api/validation/:id/result",
  "POST /api/v1/validations/:id/launch",
  "POST /api/v1/validation/:id/launch",
  "POST /api/validation/complete",
  "POST /api/v1/validation/complete",
  "POST /api/v1/blueprints/:id/launch",
  "POST /api/v1/validation/:id/select-path",
  "POST /api/v1/validations/:id/select-path",
  "GET /api/identity/current",
  "POST /api/internal/auth/validate",
] as const;

// GET /api/v1/health/routes — development / deploy smoke (not for production clients)
router.get("/v1/health/routes", (_req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.EXPOSE_ROUTE_MANIFEST !== "true") {
    res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } });
    return;
  }
  success(res, { routes: KEY_API_ROUTES, mountedUnder: "/api" });
});

export default router;
