import { Router, type Request, type Response } from "express";
import { Webhook } from "svix";
import { logger } from "../lib/logger.js";
import { applyEmailWebhookEvent } from "../services/NotificationService.js";
import { externalSignalGateway } from "../engines/signals/ExternalSignalGateway.js";
import { PHASE2_WEBHOOK_SOURCES } from "../engines/signals/ExternalSignalTrust.js";

/** Express 5 does not export `RawBodyRequest`; body is `Buffer` from `express.raw`. */
type RawWebhookRequest = Request & { body?: Buffer | string };

const router = Router();

function parseWebhookJsonBody(req: Request): Record<string, unknown> {
  const payload = (req as RawWebhookRequest).body;
  if (payload instanceof Buffer) {
    const raw = payload.toString("utf8").trim();
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  }
  if (typeof payload === "string") {
    return payload.trim() ? (JSON.parse(payload) as Record<string, unknown>) : {};
  }
  if (payload && typeof payload === "object") {
    return payload as Record<string, unknown>;
  }
  return {};
}

/**
 * GAP G8 — Phase 2 webhook ingress: POST /api/webhooks/:source?user_id=&blueprint_id=
 */
router.post("/:source", async (req: Request, res: Response) => {
  const sourceParam = req.params.source;
  const source = typeof sourceParam === "string" ? sourceParam : sourceParam?.[0] ?? "";
  if (source === "notifications") {
    res.status(404).json({ received: false, error: "use /api/webhooks/notifications/bounce" });
    return;
  }

  const userId = typeof req.query.user_id === "string" ? req.query.user_id : "";
  const blueprintId =
    typeof req.query.blueprint_id === "string" ? req.query.blueprint_id : undefined;

  if (!userId) {
    res.status(400).json({ received: true, accepted: false, reason: "user_id query param required" });
    return;
  }

  try {
    const rawPayload = parseWebhookJsonBody(req);
    const result = await externalSignalGateway.receive({
      userId,
      blueprintId,
      sourceName: source,
      sourceType: "webhook",
      rawPayload,
      signature:
        typeof req.headers["x-webhook-signature"] === "string"
          ? req.headers["x-webhook-signature"]
          : undefined,
    });

    res.status(200).json({ received: true, ...result });
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), source },
      "[Webhook] external signal handler error",
    );
    res.status(200).json({
      received: true,
      accepted: false,
      reason: err instanceof Error ? err.message : "processing_failed",
    });
  }
});

router.get("/sources", (_req, res) => {
  res.status(200).json({
    received: true,
    configured_sources: [...PHASE2_WEBHOOK_SOURCES, "manual_evidence", "linkedin_post"],
  });
});

router.post("/notifications/bounce", async (req: Request, res) => {
  try {
    const payload = (req as RawWebhookRequest).body;

    let body: Record<string, unknown>;

    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (secret?.trim()) {
      const svixId = req.headers["svix-id"];
      const svixTimestamp = req.headers["svix-timestamp"];
      const svixSignature = req.headers["svix-signature"];

      if (typeof svixId !== "string" || typeof svixTimestamp !== "string" || typeof svixSignature !== "string") {
        logger.warn("[Webhook] missing Svix headers — rejecting");
        res.status(400).json({ error: "missing_svix_headers" });
        return;
      }

      if (!(payload instanceof Buffer)) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }

      const wh = new Webhook(secret);
      body = wh.verify(payload.toString("utf8"), {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as Record<string, unknown>;
    } else {
      const raw =
        payload instanceof Buffer ? payload.toString("utf8") : typeof payload === "string" ? payload : "{}";
      body = JSON.parse(raw || "{}") as Record<string, unknown>;
      logger.warn("[Webhook] RESEND_WEBHOOK_SECRET unset — accepting unsigned payload (development)");
    }

    logger.info({ type: body["type"] }, "[Webhook] Resend bounce/complaint event");

    await applyEmailWebhookEvent(body);

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error(
      {
        message: error instanceof Error ? error.message : String(error),
      },
      "[Webhook] bounce handler error",
    );
    if (process.env.RESEND_WEBHOOK_SECRET?.trim()) {
      res.status(400).json({ received: false, error: "verification_or_processing_failed" });
      return;
    }
    res.status(200).json({ received: true });
  }
});

export default router;
