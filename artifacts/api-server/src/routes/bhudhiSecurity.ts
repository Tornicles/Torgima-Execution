import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { securityEngine } from "../bhudhi/security/security-engine/SecurityEngine.js";

const router = Router();

const capabilitySchema = z.object({
  capability: z.string(),
  level: z.enum(["PUBLIC", "LIMITED", "PRIVILEGED", "CRITICAL", "IMMUTABLE"]),
  scope: z.string().optional(),
  expiration: z.string().optional(),
});

const securityBodySchema = z.object({
  blueprintId: z.string().uuid(),
  identity: z.record(z.string(), z.unknown()).optional(),
  governance: z.record(z.string(), z.unknown()).optional(),
  execution: z.record(z.string(), z.unknown()).optional(),
  world: z.record(z.string(), z.unknown()).optional(),
  organization: z.record(z.string(), z.unknown()).optional(),
  capabilities: z.array(capabilitySchema).optional(),
  actorId: z.string().optional(),
  requestedPermission: z.enum(["read", "execute", "approve", "delegate", "recover"]).optional(),
  constraints: z.array(z.string()).optional(),
});

// POST /api/bhudhi/security/verify
router.post("/bhudhi/security/verify", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = securityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid security payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const security = await securityEngine.verify({
      ...parsed.data,
      actorId: parsed.data.actorId ?? auth.userId,
    });

    bhudhiSuccess(res, {
      success: true,
      security,
      insight: `Trust ${Math.round(security.trustScore * 100)}% — ${security.decision}`,
      nextSteps: [
        "POST /api/bhudhi/security/trust",
        "POST /api/bhudhi/security/authorize",
      ],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/security/trust
router.post("/bhudhi/security/trust", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = securityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid trust payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const trust = await securityEngine.trust({
      ...parsed.data,
      actorId: parsed.data.actorId ?? auth.userId,
    });
    bhudhiSuccess(res, { success: true, trust });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/security/authorize
router.post("/bhudhi/security/authorize", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = securityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid authorize payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const authorization = await securityEngine.authorize(
      { ...parsed.data, actorId: parsed.data.actorId ?? auth.userId },
      parsed.data.requestedPermission ?? "execute",
    );
    bhudhiSuccess(res, { success: true, authorization });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/security/threat
router.post("/bhudhi/security/threat", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = securityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid threat payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const threats = await securityEngine.threat(parsed.data);
    bhudhiSuccess(res, { success: true, threats });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/security/respond
router.post("/bhudhi/security/respond", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = securityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid respond payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const response = await securityEngine.respond(parsed.data);
    bhudhiSuccess(res, { success: true, response });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/security/history
router.post("/bhudhi/security/history", async (req, res) => {
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

    const history = await securityEngine.history(parsed.data.blueprintId, parsed.data.limit);
    bhudhiSuccess(res, { success: true, history });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
