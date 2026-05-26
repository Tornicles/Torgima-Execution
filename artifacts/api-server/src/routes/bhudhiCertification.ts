import { Router } from "express";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { bhudhiCertification } from "../monitoring/certification.js";
import { handleError } from "../lib/utils.js";

const router = Router();

/** GET /api/bhudhi/certification — Bhudhi Readiness Score (BRS) */
router.get("/bhudhi/certification", async (req, res) => {
  try {
    const certification = await bhudhiCertification.calculate();
    const httpStatus = certification.category === "not-ready" ? 503 : 200;
    bhudhiSuccess(
      res,
      {
        success: certification.category !== "not-ready",
        certification,
        insight:
          certification.overall >= 85
            ? "Enterprise-ready — all major criteria optimal"
            : certification.overall >= 70
              ? "Production-ready with minor follow-ups"
              : "Improvements required before production launch",
        nextSteps: certification.nextSteps.slice(0, 3),
      },
      httpStatus,
    );
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
