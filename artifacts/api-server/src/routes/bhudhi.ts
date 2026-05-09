import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { ValidationService } from "../services/ValidationService.js";
import { BhudhiCore } from "../bhudhi/BhudhiCore.js";
import { success, failure, handleError } from "../lib/utils.js";

const router = Router();
const bhudhi = new BhudhiCore();

// POST /api/bhudhi/structure-goal
router.post("/bhudhi/structure-goal", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const schema = z.object({
      rawGoal:         z.string().min(3).max(500),
      purpose:         z.string().max(1000).optional(),
      timeframe:       z.string().max(200).optional(),
      commitmentLevel: z.enum(["low", "medium", "high", "full"]).optional(),
      currentContext:  z.string().max(1000).optional(),
      successSignal:   z.string().max(500).optional(),
      knownBlockers:   z.string().max(500).optional(),
      domainHints:     z.array(z.string()).optional(),
      idempotencyKey:  z.string().min(1).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }

    const input = parsed.data;
    const structured = await ValidationService.structureGoal({
      userId: auth.userId,
      input: {
        rawGoal:         input.rawGoal,
        purpose:         input.purpose,
        timeframe:       input.timeframe,
        commitmentLevel: input.commitmentLevel,
        currentContext:  input.currentContext,
        successSignal:   input.successSignal,
        knownBlockers:   input.knownBlockers,
        domainHints:     input.domainHints,
        idempotencyKey:  input.idempotencyKey ?? `bhudhi_${auth.userId}_${Date.now()}`,
      },
    });

    success(res, {
      structured,
      canProceed: structured.validationVerdict !== "INVALID",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/explain-state
router.post("/bhudhi/explain-state", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const { blueprintId, focus } = req.body as { blueprintId?: string; focus?: string };
    const result = await bhudhi.call({
      trigger: "condition_explanation",
      userId:  auth.userId,
      context: { blueprintId, focus },
    });
    const output = result.output as Record<string, unknown>;
    success(res, {
      summary:        output["summary"]        ?? "Your execution system is running. Keep going.",
      condition:      output["condition"]       ?? "building",
      recommendation: output["recommendation"] ?? "Complete your next active task.",
      details:        output["details"]         ?? [],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
