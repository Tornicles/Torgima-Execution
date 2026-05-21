import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { success, failure, checkFeatureFlag } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { FEATURE_FLAGS } from "../constants/feature-flags.js";
import { TorgimaError } from "../lib/errors.js";
import {
  createPersonalMessage,
  recordVoiceMessage,
  listMessages,
  searchMessages,
  addAttachment,
  getBlockers,
  resolveBlocker,
  saveStatusSnapshot,
  generateUploadUrl,
} from "../engines/chat/PersonalChatEngine.js";

const router = Router();

async function requireChatEnabled() {
  const on = await checkFeatureFlag(FEATURE_FLAGS.CHAT_ENABLED);
  if (!on) throw new TorgimaError("FEATURE_DISABLED", "Personal chat is not enabled", false);
}

router.post("/chat/messages", async (req, res) => {
  try {
    await requireChatEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        messageType: z.enum(["text", "voice", "status-update", "blocker", "quick-note"]),
        content: z.string().optional(),
        voiceUrl: z.string().optional(),
        voiceDurationSeconds: z.number().int().optional(),
        voiceTranscription: z.string().optional(),
        linkedOrderId: z.string().uuid().optional(),
        linkedPrincipleId: z.string().uuid().optional(),
        tags: z.array(z.string()).optional(),
        forceBlocker: z.boolean().optional(),
      })
      .parse(req.body);

    const result = await createPersonalMessage({
      userId: auth.userId,
      ...body,
    });
    success(res, result, 201);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/chat/voice/record", async (req, res) => {
  try {
    await requireChatEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        voiceUrl: z.string().url().optional(),
        duration: z.number().int().min(1),
        transcription: z.string().optional(),
        linkedOrderId: z.string().uuid().optional(),
      })
      .parse(req.body);

    const voiceUrl = body.voiceUrl ?? generateUploadUrl(auth.userId, "voice");
    const result = await recordVoiceMessage({
      userId: auth.userId,
      voiceUrl,
      durationSeconds: body.duration,
      transcription: body.transcription,
      linkedOrderId: body.linkedOrderId,
    });
    success(res, result, 201);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/chat/messages", async (req, res) => {
  try {
    await requireChatEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const messages = await listMessages({
      userId: auth.userId,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
      messageType: req.query.type as string | undefined,
      isBlocker: req.query.blocker === "true" ? true : undefined,
    });
    success(res, { messages });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/chat/search", async (req, res) => {
  try {
    await requireChatEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const q = z.string().min(1).parse(req.query.q);
    const results = await searchMessages({
      userId: auth.userId,
      query: q,
      messageType: req.query.type as string | undefined,
      isBlocker: req.query.blocker === "true" ? true : undefined,
      tags: req.query.tags ? String(req.query.tags).split(",") : undefined,
    });
    success(res, { results, count: results.length });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/chat/blockers", async (req, res) => {
  try {
    await requireChatEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const status = (req.query.status as string) ?? "active";
    const minSeverity = req.query.severity
      ? Number(String(req.query.severity).split(",")[0])
      : undefined;
    const blockers = await getBlockers({
      userId: auth.userId,
      status,
      minSeverity,
    });
    success(res, { blockers });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/chat/blockers/:blockerId/resolve", async (req, res) => {
  try {
    await requireChatEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const row = await resolveBlocker({
      userId: auth.userId,
      blockerId: req.params.blockerId,
      resolutionNote: req.body.resolutionNote,
      resolutionDate: req.body.resolutionDate,
    });
    if (!row) {
      failure(res, "NOT_FOUND", "Blocker not found", 404);
      return;
    }
    success(res, { blocker: row });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/chat/attachments", async (req, res) => {
  try {
    await requireChatEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        messageId: z.string().uuid(),
        fileUrl: z.string().url(),
        fileName: z.string().min(1),
        fileType: z.string().optional(),
        fileSize: z.number().int().optional(),
      })
      .parse(req.body);

    const att = await addAttachment({ userId: auth.userId, ...body });
    success(res, { attachment: att }, 201);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/chat/status", async (req, res) => {
  try {
    await requireChatEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        status: z.string().min(1),
        energy: z.number().int().min(1).max(10),
        clarity: z.number().int().min(1).max(10),
        momentum: z.number().int().min(1).max(10),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const snap = await saveStatusSnapshot({ userId: auth.userId, ...body });
    success(res, { snapshot: snap }, 201);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
