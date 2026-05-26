import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { organizationEngine } from "../bhudhi/organization/organization-engine/OrganizationEngine.js";

const router = Router();

const orgBodySchema = z.object({
  blueprintId: z.string().uuid(),
  name: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  users: z
    .array(
      z.object({
        userId: z.string().uuid(),
        role: z.string().optional(),
        department: z.string().optional(),
      }),
    )
    .optional(),
  roles: z
    .array(
      z.object({
        roleKey: z.string(),
        authority: z.enum(["OWNER", "EXECUTIVE", "MANAGER", "LEAD", "MEMBER", "OBSERVER"]),
        department: z.string().optional(),
      }),
    )
    .optional(),
  projects: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        ownerId: z.string().uuid().optional(),
        status: z.string().optional(),
      }),
    )
    .optional(),
  strategy: z.record(z.string(), z.unknown()).optional(),
  signals: z.record(z.string(), z.unknown()).optional(),
  execution: z.record(z.string(), z.unknown()).optional(),
  world: z.record(z.string(), z.unknown()).optional(),
  identity: z.record(z.string(), z.unknown()).optional(),
});

// POST /api/bhudhi/organization/create
router.post("/bhudhi/organization/create", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = orgBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid organization payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const users = parsed.data.users ?? [{ userId: auth.userId, role: "OWNER", department: "strategy" }];
    const org = await organizationEngine.create({ ...parsed.data, users });

    bhudhiSuccess(res, {
      success: true,
      organization: org,
      insight: `Organization ${org.organizationState.name} — health ${org.health.score}/100`,
      confidence: org.alignment.score,
      nextSteps: ["POST /api/bhudhi/organization/health", "POST /api/bhudhi/organization/coordinate"],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/organization/health
router.post("/bhudhi/organization/health", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = orgBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const health = await organizationEngine.health(parsed.data.blueprintId, parsed.data);
    bhudhiSuccess(res, { success: true, health });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/organization/align
router.post("/bhudhi/organization/align", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = orgBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid align payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const alignment = await organizationEngine.align(parsed.data.blueprintId, parsed.data);
    bhudhiSuccess(res, { success: true, alignment });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/organization/coordinate
router.post("/bhudhi/organization/coordinate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = orgBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid coordinate payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const coordination = await organizationEngine.coordinate(parsed.data.blueprintId, parsed.data);
    bhudhiSuccess(res, { success: true, coordination });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/organization/sync
router.post("/bhudhi/organization/sync", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = orgBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid sync payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const teamSync = await organizationEngine.syncTeams(parsed.data.blueprintId, parsed.data);
    bhudhiSuccess(res, { success: true, teamSync });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/organization/history
router.post("/bhudhi/organization/history", async (req, res) => {
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

    const history = await organizationEngine.history(parsed.data.blueprintId, parsed.data.limit);
    bhudhiSuccess(res, { success: true, history });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
