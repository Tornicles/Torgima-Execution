import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { worldEngine } from "../bhudhi/world/world-engine/WorldEngine.js";

const entityTypeSchema = z.enum([
  "USER",
  "GOAL",
  "PROJECT",
  "TASK",
  "TEAM",
  "RESOURCE",
  "EVENT",
  "RISK",
  "SYSTEM",
  "AGENT",
]);

const relationTypeSchema = z.enum([
  "depends_on",
  "influences",
  "blocks",
  "supports",
  "conflicts",
  "inherits",
]);

const router = Router();

// POST /api/bhudhi/world/sync
router.post("/bhudhi/world/sync", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        trigger: z.string().optional(),
        memory: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
        signals: z.record(z.string(), z.unknown()).optional(),
        conditions: z.record(z.string(), z.unknown()).optional(),
        blueprint: z.record(z.string(), z.unknown()).optional(),
        life: z.record(z.string(), z.unknown()).optional(),
        simulation: z.record(z.string(), z.unknown()).optional(),
        feedback: z.record(z.string(), z.unknown()).optional(),
        execution: z.record(z.string(), z.unknown()).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid world sync payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const world = await worldEngine.sync({
      blueprintId: parsed.data.blueprintId,
      userId: auth.userId,
      trigger: parsed.data.trigger,
      memory: parsed.data.memory,
      signals: parsed.data.signals,
      conditions: parsed.data.conditions,
      blueprint: parsed.data.blueprint,
      life: parsed.data.life,
      simulation: parsed.data.simulation,
      feedback: parsed.data.feedback,
      execution: parsed.data.execution,
    });

    bhudhiSuccess(res, {
      success: true,
      world,
      insight: world.prediction?.next ?? "World model synchronized",
      confidence: world.confidence,
      nextSteps: ["POST /api/bhudhi/world/predict", "POST /api/bhudhi/simulation/run"],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/world/entity
router.post("/bhudhi/world/entity", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        type: entityTypeSchema,
        label: z.string().min(1),
        state: z.record(z.string(), z.unknown()).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid entity payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const entity = await worldEngine.addEntity(
      parsed.data.blueprintId,
      parsed.data.type,
      parsed.data.label,
      parsed.data.state,
    );

    bhudhiSuccess(res, { success: true, entity });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/world/state
router.post("/bhudhi/world/state", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        entityId: z.string().uuid(),
        patch: z.record(z.string(), z.unknown()),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid state payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const entity = await worldEngine.updateState(
      parsed.data.blueprintId,
      parsed.data.entityId,
      parsed.data.patch,
    );

    if (!entity) {
      failure(res, "NOT_FOUND", "Entity not found", 404);
      return;
    }

    bhudhiSuccess(res, { success: true, entity });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/world/relationship
router.post("/bhudhi/world/relationship", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        fromEntityId: z.string().uuid(),
        toEntityId: z.string().uuid(),
        type: relationTypeSchema,
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid relationship payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const rel = await worldEngine.addRelationship(
      parsed.data.blueprintId,
      parsed.data.fromEntityId,
      parsed.data.toEntityId,
      parsed.data.type,
    );

    bhudhiSuccess(res, { success: true, relationship: rel });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/world/predict
router.post("/bhudhi/world/predict", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const prediction = await worldEngine.predict(parsed.data.blueprintId);
    const entities = await worldEngine.entities(parsed.data.blueprintId);

    bhudhiSuccess(res, { success: true, prediction, entityCount: entities.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/world/branch
router.post("/bhudhi/world/branch", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        scenario: z.string().min(1),
        fromVersion: z.number().int().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid branch payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const branch = await worldEngine.branch(
      parsed.data.blueprintId,
      parsed.data.scenario,
      parsed.data.fromVersion,
    );

    bhudhiSuccess(res, { success: true, branch });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
