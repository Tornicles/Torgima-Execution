import { Router } from "express";
import { z } from "zod/v4";
import { db, blueprints, signalSnapshots, conditions, orders } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { ValidationService } from "../services/ValidationService.js";
import { explainState } from "../bhudhi/BhudhiCore.js";
import { success, failure, handleError } from "../lib/utils.js";

const router = Router();

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

    const [blueprint] = await db
      .select()
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .orderBy(desc(blueprints.updated_at))
      .limit(1);

    if (!blueprint) {
      success(res, { explanation: null, fallbackUsed: false });
      return;
    }

    const [signal] = await db
      .select()
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprint.id), eq(signalSnapshots.is_current, true)))
      .limit(1);

    const [condition] = await db
      .select()
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, blueprint.id), eq(conditions.is_current, true)))
      .limit(1);

    const [currentOrder] = await db
      .select({ title: orders.title })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, blueprint.id),
          eq(orders.user_id, auth.userId),
          inArray(orders.status, ["pending", "active"]),
        ),
      )
      .orderBy(desc(orders.priority))
      .limit(1);

    const result = await explainState({
      userId:            auth.userId,
      blueprintId:       blueprint.id,
      stateVersion:      blueprint.state_version,
      condition:         condition?.condition ?? blueprint.current_condition ?? "urgency",
      completionRate:    signal?.completion_rate ?? 0,
      weightedScore:     signal?.weighted_score ?? 0,
      momentum:          signal?.momentum ?? 0,
      trend:             signal?.trend ?? "stable",
      goal:              blueprint.goal,
      currentTaskTitle:  currentOrder?.title,
      conditionDuration: condition?.duration_days ?? 0,
    });

    success(res, {
      explanation:  result.output?.data ?? null,
      fallbackUsed: result.fallbackUsed,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
