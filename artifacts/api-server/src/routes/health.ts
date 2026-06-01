import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { success, handleError } from "../lib/utils.js";
import { requireAuth } from "../lib/auth.js";
import { getUserFacingHealthState } from "../services/SystemHealthService.js";
import { verifyBlueprintLaunchSchema, verifyOnboardingSchema } from "../lib/verifySchema.js";

const router: IRouter = Router();

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
  await pool.query("SELECT 1");
}

export async function checkBhudhiAPIAvailability(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  if (process.env.NODE_ENV === "production" && !apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required in production");
  }
}

export async function checkPgBossWorkers(): Promise<void> {
  const result = await pool.query("SELECT to_regclass('pgboss.job') AS job_table");
  if (!result.rows[0]?.job_table) {
    throw new Error("pg-boss job table not found");
  }
}

export async function checkSignalEngineRecency(maxAgeHours = 48): Promise<number | null> {
  const result = await pool.query<{ latest: Date | null }>(
    "SELECT MAX(created_at) AS latest FROM signal_snapshots",
  );
  const latest = result.rows[0]?.latest;
  if (!latest) return null;

  const ageHours = (Date.now() - new Date(latest).getTime()) / (60 * 60 * 1000);
  if (ageHours > maxAgeHours) {
    throw new Error(`latest signal snapshot is stale: ${ageHours.toFixed(1)}h`);
  }
  return ageHours;
}

async function collectProductionMetrics(): Promise<ProductionHealthResponse["metrics"]> {
  const [pendingR, dlR, healthR, signalR] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS c FROM events WHERE status = 'pending'").catch(() => null),
    pool.query("SELECT COUNT(*)::int AS c FROM dead_letter_events WHERE resolved = false").catch(() => null),
    pool.query("SELECT COUNT(*)::int AS c FROM system_health_records WHERE health_score < 0.7").catch(() => null),
    pool.query<{ latest: Date | null }>("SELECT MAX(created_at) AS latest FROM signal_snapshots").catch(() => null),
  ]);

  const latest = signalR?.rows[0]?.latest;
  return {
    pendingEvents: pendingR ? Number(pendingR.rows[0]?.c ?? 0) : null,
    deadLetters: dlR ? Number(dlR.rows[0]?.c ?? 0) : null,
    healthIssues: healthR ? Number(healthR.rows[0]?.c ?? 0) : null,
    latestSignalAgeHours: latest ? Number(((Date.now() - new Date(latest).getTime()) / (60 * 60 * 1000)).toFixed(2)) : null,
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
  const healthy = Object.values(checks).every((check) => check === "ok");

  return {
    status: healthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.APP_VERSION ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "phase1",
    metrics: await collectProductionMetrics(),
  };
}

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Prompt 15 — production monitoring probe for external uptime checks.
router.get("/health", async (req, res) => {
  try {
    const results = await buildProductionHealthResponse();
    res.status(results.status === "healthy" ? 200 : 503).json(results);
  } catch (err) {
    handleError(req, res, err);
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
  "POST /api/v1/validations/:id/launch",
  "POST /api/v1/validation/:id/launch",
  "POST /api/v1/onboarding/select-blueprint",
  "POST /api/onboarding/select-blueprint",
  "POST /api/blueprints/:id/activate",
  "POST /api/v1/blueprints/:id/launch",
  "POST /api/v1/validation/run",
  "POST /api/v1/validation/:id/select-path",
  "POST /api/v1/validations/:id/select-path",
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
