import { Router } from "express";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { bhudhiHealthCheck } from "../monitoring/healthCheck.js";
import { collectBhudhiMetrics } from "../monitoring/metricsCollector.js";
import { handleError } from "../lib/utils.js";

const router = Router();

/** GET /api/bhudhi/monitoring/health — deep Bhudhi layer health (uptime probes) */
router.get("/bhudhi/monitoring/health", async (req, res) => {
  try {
    const status = await bhudhiHealthCheck.check();
    const httpStatus = status.status === "healthy" ? 200 : status.status === "degraded" ? 200 : 503;
    bhudhiSuccess(res, { success: status.status !== "unhealthy", ...status }, httpStatus);
  } catch (err) {
    handleError(req, res, err);
  }
});

/** GET /api/bhudhi/monitoring/metrics — Bhudhi + platform metrics bundle */
router.get("/bhudhi/monitoring/metrics", async (req, res) => {
  try {
    const metrics = await collectBhudhiMetrics();
    bhudhiSuccess(res, { success: true, metrics });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
