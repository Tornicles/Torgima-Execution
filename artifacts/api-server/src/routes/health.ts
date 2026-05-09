import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { success, handleError } from "../lib/utils.js";

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
        version: "phase1-prompt3",
      },
      allPassing ? 200 : 503,
    );
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
