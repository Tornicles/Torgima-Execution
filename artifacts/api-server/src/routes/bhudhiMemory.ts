import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { blueprintIdFromQuery, requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { memoryGraph } from "../bhudhi/kernel/memory/memory-graph/MemoryGraph.js";
import { memoryAdapter } from "../bhudhi/kernel/memory/memory-adapter/MemoryAdapter.js";

const router = Router();

// POST /api/bhudhi/memory/query
router.post("/bhudhi/memory/query", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        query: z.string().optional(),
        nodeTypes: z.array(z.string()).optional(),
        filters: z.record(z.string(), z.unknown()).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid memory query", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const results = await memoryGraph.queryMemory(parsed.data.blueprintId, parsed.data);
    bhudhiSuccess(res, {
      success: true,
      results,
      count: results.nodes.length,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/memory/stats
router.get("/bhudhi/memory/stats", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = blueprintIdFromQuery(req);

    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
    if (!ok) return;

    const stats = await memoryGraph.getStats(blueprintId);
    bhudhiSuccess(res, { success: true, stats });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/memory/migrate
router.post("/bhudhi/memory/migrate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const result = await memoryAdapter.migrateAll(parsed.data.blueprintId);
    bhudhiSuccess(res, { success: true, result });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/memory/timeline
router.get("/bhudhi/memory/timeline", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = blueprintIdFromQuery(req);
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;

    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
    if (!ok) return;

    const timeline = await memoryGraph.getTimeline(blueprintId, limit);
    bhudhiSuccess(res, { success: true, timeline, count: timeline.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/memory/related
router.get("/bhudhi/memory/related", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = blueprintIdFromQuery(req);
    const nodeId = typeof req.query.nodeId === "string" ? req.query.nodeId : undefined;

    if (!blueprintId || !nodeId) {
      failure(res, "VALIDATION_ERROR", "blueprintId and nodeId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
    if (!ok) return;

    const related = await memoryGraph.getRelated(blueprintId, nodeId);
    bhudhiSuccess(res, { success: true, related, count: related.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/memory/node
router.post("/bhudhi/memory/node", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        nodeType: z.string(),
        nodeId: z.string(),
        content: z.record(z.string(), z.unknown()),
        summary: z.string(),
        sourceEngine: z.string(),
        confidence: z.number().optional(),
        importance: z.number().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid node payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const node = await memoryGraph.addNode(parsed.data);
    bhudhiSuccess(res, { success: true, node });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/memory/consolidate
router.post("/bhudhi/memory/consolidate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const consolidated = await memoryGraph.consolidate(parsed.data.blueprintId);
    bhudhiSuccess(res, { success: true, consolidated });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
