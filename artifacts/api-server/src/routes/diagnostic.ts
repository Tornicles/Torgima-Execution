import { Router } from "express";
import { withAuth } from "../lib/auth.js";
import { runPipelineDiagnostic, internalAuthConfigured, bhudhiModelConfigured } from "../lib/pipelineDiagnostic.js";
import { handleError } from "../lib/utils.js";
import { logger } from "../lib/logger.js";

const router = Router();

/** All diagnostic routes require INTERNAL_AUTH_SECRET (x-internal-auth). */
router.use("/diagnostic", withAuth("INTERNAL_SERVICE"));

/**
 * GET /api/diagnostic/pipeline
 * Layer-by-layer production debugger — no secrets in response.
 */
router.get("/diagnostic/pipeline", async (req, res) => {
  try {
    const report = await runPipelineDiagnostic();

    logger.info(
      {
        type: "diagnostic_pipeline",
        ok: report.ok,
        rootCause: report.rootCause,
        failing: report.failing.map((f) => f.layer),
      },
      "[Diagnostic] pipeline",
    );

    res.status(report.ok ? 200 : 503).json({
      ok: report.ok,
      rootCause: report.rootCause,
      pipeline: report.pipeline,
      failing: report.failing,
      passing: report.passing,
      recommendation: report.recommendation,
      meta: {
        internalAuthConfigured: internalAuthConfigured(),
        bhudhiModel: bhudhiModelConfigured(),
        runtime: process.env.TORGIMA_RUNTIME ?? "unknown",
      },
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
