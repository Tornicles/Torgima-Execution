import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { success, handleError } from "../lib/utils.js";
import { requireAuth } from "../lib/auth.js";
import { getUserFacingHealthState } from "../services/SystemHealthService.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", async (req, res) => {
  try {
    const checks: Record<string, boolean> = {
      database: false,
      event_table: false,
      blueprint_table: false,
    };

    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      checks["database"] = true;
    } finally {
      client.release();
    }

    try {
      await pool.query("SELECT COUNT(*) FROM events LIMIT 1");
      checks["event_table"] = true;
    } catch {
      checks["event_table"] = false;
    }

    try {
      await pool.query("SELECT COUNT(*) FROM blueprints LIMIT 1");
      checks["blueprint_table"] = true;
    } catch {
      checks["blueprint_table"] = false;
    }

    const pendingResult = await pool
      .query("SELECT COUNT(*) as count FROM events WHERE status = 'pending'")
      .catch(() => null);
    const dlResult = await pool
      .query("SELECT COUNT(*) as count FROM dead_letter_events WHERE resolved = false")
      .catch(() => null);

    const pending = pendingResult ? parseInt(pendingResult.rows[0].count, 10) : -1;
    const deadLetters = dlResult ? parseInt(dlResult.rows[0].count, 10) : -1;

    const allPassing = Object.values(checks).every(Boolean);

    success(
      res,
      {
        ...checks,
        pending_events: pending,
        unresolved_dead_letters: deadLetters,
        timestamp: new Date().toISOString(),
        version: "phase1-prompt4",
      },
      allPassing ? 200 : 503,
    );
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/health/current — user-safe, never reveals internal failure detail.
// Spec: Prompt 6 §STEP 7, DOC_17 §19–20.
router.get("/health/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const health = await getUserFacingHealthState(auth.userId);
    success(res, health);
  } catch {
    success(res, { systemOperational: true, executionAvailable: true });
  }
});

export default router;
