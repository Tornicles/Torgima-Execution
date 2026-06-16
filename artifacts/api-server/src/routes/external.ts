/**
 * DOC27 — external signal upload, link, and webhook routes.
 */

import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import {
  processExternalLink,
  processFileUpload,
} from "../engines/external/ExternalSignalProcessor.js";
import { processWebhook, isApprovedWebhookSource } from "../engines/external/WebhookRouter.js";
import { ALLOWED_UPLOAD_MIME_TYPES } from "../engines/external/externalTypes.js";

const router = Router();

const uploadSchema = z.object({
  blueprintId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive().max(10_000_000),
  contentBase64: z.string().min(1),
  description: z.string().max(2000).optional(),
  taskId: z.string().uuid().optional(),
  academyTaskId: z.string().uuid().optional(),
});

const linkSchema = z.object({
  blueprintId: z.string().uuid(),
  url: z.string().url(),
  description: z.string().max(2000).optional(),
  taskId: z.string().uuid().optional(),
});

function parseWebhookBody(body: unknown): Record<string, unknown> {
  if (body instanceof Buffer) {
    const raw = body.toString("utf8").trim();
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  }
  if (typeof body === "string") {
    return body.trim() ? (JSON.parse(body) as Record<string, unknown>) : {};
  }
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

/** POST /api/external/upload */
router.post("/upload", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = uploadSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid upload payload", 422);
      return;
    }

    const buffer = Buffer.from(parsed.data.contentBase64, "base64");
    if (buffer.length !== parsed.data.sizeBytes) {
      failure(res, "VALIDATION_ERROR", "Uploaded size does not match declared sizeBytes", 422);
      return;
    }

    const result = await processFileUpload({
      userId: auth.userId,
      file: {
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        sizeBytes: parsed.data.sizeBytes,
        buffer,
      },
      context: {
        blueprintId: parsed.data.blueprintId,
        taskId: parsed.data.taskId,
        academyTaskId: parsed.data.academyTaskId,
        description: parsed.data.description,
      },
    });

    if (!result.ok) {
      failure(res, result.code, result.message, result.code === "FILE_TOO_LARGE" ? 413 : 400, {
        detail: `Allowed types: ${ALLOWED_UPLOAD_MIME_TYPES.join(", ")}`,
      });
      return;
    }

    success(res, result, 201, { stateChanged: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

/** POST /api/external/link */
router.post("/link", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = linkSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid link payload", 422);
      return;
    }

    const result = await processExternalLink({
      userId: auth.userId,
      input: parsed.data,
    });

    if (!result.ok) {
      failure(res, result.code, result.message, 400);
      return;
    }

    success(res, result, 201, { stateChanged: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

/** POST /api/external/webhooks/:source */
router.post("/webhooks/:source", async (req, res) => {
  const sourceParam = req.params.source;
  const source = typeof sourceParam === "string" ? sourceParam : sourceParam?.[0] ?? "";

  if (!isApprovedWebhookSource(source)) {
    res.status(401).json({ ok: false, error: { code: "SOURCE_NOT_APPROVED", message: "Webhook source not approved" } });
    return;
  }

  const userId = typeof req.query.user_id === "string" ? req.query.user_id : undefined;
  const blueprintId =
    typeof req.query.blueprint_id === "string" ? req.query.blueprint_id : undefined;

  try {
    const payload = parseWebhookBody(req.body);
    const signature =
      typeof req.headers["x-webhook-signature"] === "string"
        ? req.headers["x-webhook-signature"]
        : undefined;

    const result = await processWebhook({
      source,
      payload,
      signature,
      userId,
      blueprintId,
    });

    if (!result.ok) {
      res.status(result.status).json({ ok: false, error: { code: result.code, message: result.message } });
      return;
    }

    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
