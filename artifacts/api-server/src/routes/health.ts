import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { success, handleError } from "../lib/utils.js";
import { requireAuth } from "../lib/auth.js";
import { getUserFacingHealthState } from "../services/SystemHealthService.js";
import { verifyOnboardingSchema } from "../lib/verifySchema.js";
import { ensureSchemaPatches } from "../lib/ensureSchema.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

type TableCheck = readonly [string, string];

// Prompt 14 — aggregate readiness probe (database + core tables).
router.get("/health", async (req, res) => {
  try {
    const checks: Record<string, boolean> = {};

    const tableChecks: TableCheck[] = [
      ["database", "SELECT 1"],
      ["blueprints", "SELECT COUNT(*) FROM blueprints LIMIT 1"],
      ["signals", "SELECT COUNT(*) FROM signal_snapshots LIMIT 1"],
      ["conditions", "SELECT COUNT(*) FROM conditions LIMIT 1"],
      ["enforcement", "SELECT COUNT(*) FROM enforcement_packages LIMIT 1"],
      ["events", "SELECT COUNT(*) FROM events LIMIT 1"],
      ["notifications", "SELECT COUNT(*) FROM notification_logs LIMIT 1"],
      ["identity", "SELECT COUNT(*) FROM user_identity_states LIMIT 1"],
      ["framework_signals", "SELECT COUNT(*) FROM framework_signal_snapshots LIMIT 1"],
    ];

    for (const [name, sqlText] of tableChecks) {
      try {
        await pool.query(sqlText);
        checks[name] = true;
      } catch {
        checks[name] = false;
      }
    }

    const [pendingR, dlR, healthR] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS c FROM events WHERE status = 'pending'").catch(() => null),
      pool
        .query("SELECT COUNT(*)::int AS c FROM dead_letter_events WHERE resolved = false")
        .catch(() => null),
      pool.query("SELECT COUNT(*)::int AS c FROM system_health_logs WHERE status = 'degraded'").catch(() => null),
    ]);

    const pending_events = pendingR ? Number(pendingR.rows[0]?.c ?? 0) : -1;
    const dead_letters = dlR ? Number(dlR.rows[0]?.c ?? 0) : -1;
    const health_issues = healthR ? Number(healthR.rows[0]?.c ?? 0) : -1;

    const allPassing = Object.values(checks).every(Boolean);

    success(
      res,
      {
        ...checks,
        pending_events,
        dead_letters,
        health_issues,
        timestamp: new Date().toISOString(),
        version: "phase1-prompt14",
      },
      allPassing ? 200 : 503,
    );
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
    const before = await verifyOnboardingSchema();
    let patchResult: { applied: number; failed: number; verified: boolean } | null = null;
    if (!before.ok) {
      patchResult = await ensureSchemaPatches();
    }
    const after = await verifyOnboardingSchema();
    success(res, {
      ok: after.ok,
      before,
      after,
      patchResult,
      hint: after.ok
        ? "Schema ready for /api/onboarding/goal"
        : "Apply scripts/migrations/*.sql to the DATABASE_URL Postgres instance",
    }, after.ok ? 200 : 503);
  } catch (err) {
    handleError(_req, res, err);
  }
});

export default router;
