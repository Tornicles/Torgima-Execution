import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { blueprintIdFromQuery, requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { bhudhiProtocol } from "../bhudhi/protocol/BhudhiProtocol.js";
import { protocolRouter } from "../bhudhi/protocol/ProtocolRouter.js";
import { PROTOCOL_EXAMPLES } from "../bhudhi/protocol/examples.js";

const router = Router();

// POST /api/bhudhi/protocol/send
router.post("/bhudhi/protocol/send", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        from: z.string(),
        to: z.string(),
        uri: z.string().regex(/^bhudhi:\/\//),
        payload: z.record(z.string(), z.unknown()).default({}),
        messageType: z.enum(["request", "response", "event", "query"]).optional(),
        autoRoute: z.boolean().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid protocol send payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    if (parsed.data.autoRoute) {
      const out = await protocolRouter.sendAndRoute(
        parsed.data.blueprintId,
        parsed.data.from,
        parsed.data.to,
        parsed.data.uri,
        parsed.data.payload,
        parsed.data.messageType ?? "event",
        true,
      );
      bhudhiSuccess(res, { success: true, messageId: out.messageId, result: out.result });
      return;
    }

    const message = bhudhiProtocol.createMessage(
      parsed.data.from,
      parsed.data.to,
      parsed.data.uri,
      parsed.data.payload,
      parsed.data.messageType ?? "event",
    );
    const messageId = await bhudhiProtocol.send(parsed.data.blueprintId, message);
    bhudhiSuccess(res, { success: true, messageId });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/protocol/route
router.post("/bhudhi/protocol/route", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        messageId: z.string().uuid(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId and messageId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const result = await protocolRouter.route(parsed.data.blueprintId, parsed.data.messageId);
    bhudhiSuccess(res, { success: true, result });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/protocol/history
router.get("/bhudhi/protocol/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = blueprintIdFromQuery(req);
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 100;

    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
    if (!ok) return;

    const messages = await bhudhiProtocol.getHistory(blueprintId, from, to, limit);
    bhudhiSuccess(res, { success: true, messages, count: messages.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/protocol/routes
router.get("/bhudhi/protocol/routes", async (_req, res) => {
  try {
    await protocolRouter.ensureDefaults();
    const routes = await bhudhiProtocol.listRoutes();
    bhudhiSuccess(res, { success: true, routes, examples: PROTOCOL_EXAMPLES });
  } catch (err) {
    handleError(_req, res, err);
  }
});

// POST /api/bhudhi/protocol/contracts
router.post("/bhudhi/protocol/contracts", async (req, res) => {
  try {
    const parsed = z
      .object({
        engineA: z.string(),
        engineB: z.string(),
        messageTypes: z.array(z.string()),
        guarantees: z.array(z.string()),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid contract payload", 422);
      return;
    }

    const contract = await bhudhiProtocol.createContract(
      parsed.data.engineA,
      parsed.data.engineB,
      parsed.data.messageTypes,
      parsed.data.guarantees,
    );
    bhudhiSuccess(res, { success: true, contract });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/protocol/validate
router.get("/bhudhi/protocol/validate", async (req, res) => {
  try {
    const uri = typeof req.query.uri === "string" ? req.query.uri : undefined;
    if (!uri) {
      failure(res, "VALIDATION_ERROR", "uri required", 422);
      return;
    }

    const parsed = bhudhiProtocol.parseUri(uri);
    const valid = await bhudhiProtocol.validateMessage(uri, {});
    bhudhiSuccess(res, { success: true, parsed, valid });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
