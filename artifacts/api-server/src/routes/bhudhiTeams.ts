import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { teamEngine } from "../bhudhi/teams/team-engine/TeamEngine.js";

const router = Router();

const memberSchema = z.object({
  userId: z.string(),
  role: z.string().optional(),
  isAgent: z.boolean().optional(),
  weight: z.number().optional(),
});

const teamBodySchema = z.object({
  blueprintId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  name: z.string().optional(),
  members: z.array(memberSchema).optional(),
  roles: z.array(z.object({ roleKey: z.string(), userId: z.string().optional() })).optional(),
  identity: z.record(z.string(), z.unknown()).optional(),
  projects: z
    .array(z.object({ id: z.string(), name: z.string(), ownerId: z.string().optional(), status: z.string().optional() }))
    .optional(),
  execution: z.record(z.string(), z.unknown()).optional(),
  organization: z.record(z.string(), z.unknown()).optional(),
  constraints: z.array(z.string()).optional(),
  consensusModel: z.enum(["owner", "majority", "weighted", "unanimous", "advisor"]).optional(),
});

const consensusSchema = teamBodySchema.extend({
  proposal: z.string().optional(),
});

// POST /api/bhudhi/teams/create
router.post("/bhudhi/teams/create", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = teamBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid team payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const members = parsed.data.members ?? [{ userId: auth.userId, role: "OWNER" }];
    const team = await teamEngine.create({ ...parsed.data, members });

    bhudhiSuccess(res, {
      success: true,
      team,
      insight: team.recommendation,
      nextSteps: [
        "POST /api/bhudhi/teams/align",
        "POST /api/bhudhi/teams/health",
      ],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/teams/align
router.post("/bhudhi/teams/align", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = teamBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid align payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const alignment = await teamEngine.align(parsed.data);
    bhudhiSuccess(res, { success: true, alignment });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/teams/consensus
router.post("/bhudhi/teams/consensus", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = consensusSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid consensus payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const { proposal, ...rest } = parsed.data;
    const consensus = await teamEngine.consensus(rest, proposal);
    bhudhiSuccess(res, { success: true, consensus });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/teams/health
router.post("/bhudhi/teams/health", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = teamBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid health payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const health = await teamEngine.health(parsed.data);
    bhudhiSuccess(res, { success: true, health });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/teams/memory
router.post("/bhudhi/teams/memory", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({ blueprintId: z.string().uuid(), teamId: z.string().uuid() })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "teamId and blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const memory = await teamEngine.memory(parsed.data.teamId);
    bhudhiSuccess(res, { success: true, memory });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/teams/history
router.post("/bhudhi/teams/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({ blueprintId: z.string().uuid(), limit: z.number().int().min(1).max(50).optional() })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const history = await teamEngine.history(parsed.data.blueprintId, parsed.data.limit);
    bhudhiSuccess(res, { success: true, history });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
