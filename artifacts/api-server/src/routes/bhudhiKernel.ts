import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { blueprintIdFromQuery, requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { cognitiveKernel } from "../bhudhi/kernel/cognitive-kernel/CognitiveKernel.js";
import { listKernelEvents } from "../bhudhi/kernel/kernelData.js";

const router = Router();

// POST /api/bhudhi/kernel/cycle
router.post("/bhudhi/kernel/cycle", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const result = await cognitiveKernel.runCycle(parsed.data.blueprintId);

    bhudhiSuccess(res, {
      success: true,
      cycle: result.context,
      chainId: result.chainId,
      eventIds: result.eventIds,
      status: result.status,
      message: result.message,
      nextSteps: [
        "GET /api/bhudhi/kernel/context?blueprintId=...",
        "GET /api/bhudhi/kernel/events?blueprintId=...",
      ],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/kernel/context
router.get("/bhudhi/kernel/context", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = blueprintIdFromQuery(req);

    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
    if (!ok) return;

    const context = await cognitiveKernel.getSharedContext().getContext(blueprintId);
    const validation = await cognitiveKernel.getSharedContext().validateContext(blueprintId);

    bhudhiSuccess(res, { success: true, context, validation });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/kernel/events
router.get("/bhudhi/kernel/events", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = blueprintIdFromQuery(req);
    const chainId = typeof req.query.chainId === "string" ? req.query.chainId : undefined;

    if (!blueprintId && !chainId) {
      failure(res, "VALIDATION_ERROR", "blueprintId or chainId required", 422);
      return;
    }

    if (blueprintId) {
      const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
      if (!ok) return;
    }

    const events = await listKernelEvents(blueprintId, chainId);

    bhudhiSuccess(res, { success: true, events, count: events.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/kernel/registry
router.get("/bhudhi/kernel/registry", async (_req, res) => {
  try {
    await requireAuth(_req, "USER_SESSION");
    const registry = await cognitiveKernel.getRegistry();
    bhudhiSuccess(res, { success: true, registry, count: registry.length });
  } catch (err) {
    handleError(_req, res, err);
  }
});

export default router;
