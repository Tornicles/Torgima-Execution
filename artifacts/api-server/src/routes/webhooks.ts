import { Router, type RawBodyRequest } from "express";
import type { Request } from "express";
import { Webhook } from "svix";
import { logger } from "../lib/logger.js";
import { applyEmailWebhookEvent } from "../services/NotificationService.js";

const router = Router();

router.post("/notifications/bounce", async (req: Request, res) => {
  try {
    const payload = (req as RawBodyRequest<Request>).body;

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
