/**
 * PROMPT 4 — Personal chat: messages, voice, blockers, search.
 */
import crypto from "node:crypto";
import {
  db,
  personalMessages,
  messageAttachments,
  messageSearchIndex,
  blockerLogs,
  chatVoiceMessages,
  statusSnapshots,
} from "@workspace/db";
import { and, desc, eq, gte, ilike, inArray, or } from "drizzle-orm";
import { routeAndSendNotification } from "../notifications/NotificationDeliveryEngine.js";

const BLOCKER_KEYWORDS: Record<string, string[]> = {
  resource: ["need", "missing", "don't have", "dont have", "require"],
  clarity: ["unclear", "confused", "don't understand", "ambiguous"],
  dependency: ["waiting on", "depends on", "blocked by", "need approval"],
  technical: ["error", "bug", "crash", "failed", "not working"],
  personal: ["exhausted", "overwhelmed", "unmotivated", "burnt out", "burned out"],
};

export function detectBlocker(content: string): {
  isBlocker: boolean;
  blockerType?: string;
  severity: number;
  suggestedAction?: string;
} {
  const lower = content.toLowerCase();
  for (const [type, keywords] of Object.entries(BLOCKER_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      let severity = 3;
      if (lower.includes("urgent") || lower.includes("!!")) severity = 5;
      else if (lower.includes("stuck") || lower.includes("can't proceed")) severity = 4;
      return {
        isBlocker: true,
        blockerType: type,
        severity,
        suggestedAction: `Log blocker: ${type}`,
      };
    }
  }
  return { isBlocker: false, severity: 0 };
}

export function detectSentiment(content: string): "positive" | "neutral" | "negative" {
  const lower = content.toLowerCase();
  if (/\b(great|done|shipped|win|progress|clear)\b/.test(lower)) return "positive";
  if (/\b(stuck|blocked|failed|overwhelmed|confused)\b/.test(lower)) return "negative";
  return "neutral";
}

export function mapMessage(row: typeof personalMessages.$inferSelect) {
  return {
    id: row.id,
    userId: row.user_id,
    messageType: row.message_type,
    content: row.content,
    voiceUrl: row.voice_url,
    voiceDurationSeconds: row.voice_duration_seconds,
    voiceTranscription: row.voice_transcription,
    attachments: (row.attachments as string[]) ?? [],
    linkedOrderId: row.linked_order_id,
    linkedPrincipleId: row.linked_principle_id,
    sentiment: row.sentiment,
    tags: (row.tags as string[]) ?? [],
    isBlocker: row.is_blocker,
    blockerType: row.blocker_type,
    blockerSeverity: row.blocker_severity,
    createdAt: row.created_at,
  };
}

async function indexMessage(userId: string, messageId: string, text: string) {
  const searchable = text.trim();
  if (!searchable) return;
  await db.insert(messageSearchIndex).values({
    user_id: userId,
    message_id: messageId,
    searchable_text: searchable,
  });
}

async function maybeLogBlocker(params: {
  userId: string;
  messageId: string;
  content: string;
  blockerType: string;
  severity: number;
  linkedOrderId?: string;
}) {
  const [log] = await db
    .insert(blockerLogs)
    .values({
      user_id: params.userId,
      message_id: params.messageId,
      blocker_type: params.blockerType,
      severity: params.severity,
      description: params.content.slice(0, 2000),
      related_order_id: params.linkedOrderId,
      status: "active",
    })
    .returning();

  if (params.severity >= 4) {
    void routeAndSendNotification({
      userId: params.userId,
      notificationType: "blocker",
      title: `Blocker detected: ${params.blockerType}`,
      body: params.content.slice(0, 280),
      priority: params.severity,
      channelsToSend: ["push", "in-app", "email"],
    }).catch(() => undefined);
  }

  return log;
}

export async function createPersonalMessage(params: {
  userId: string;
  messageType: string;
  content?: string;
  voiceUrl?: string;
  voiceDurationSeconds?: number;
  voiceTranscription?: string;
  attachments?: string[];
  linkedOrderId?: string;
  linkedPrincipleId?: string;
  tags?: string[];
  forceBlocker?: boolean;
}) {
  const text =
    params.content ??
    params.voiceTranscription ??
    (params.messageType === "voice" ? "[voice message]" : "");
  const detection = detectBlocker(text);
  const isBlocker = params.forceBlocker ?? detection.isBlocker;
  const sentiment = detectSentiment(text);

  const [row] = await db
    .insert(personalMessages)
    .values({
      user_id: params.userId,
      message_type: params.messageType,
      content: text,
      voice_url: params.voiceUrl,
      voice_duration_seconds: params.voiceDurationSeconds,
      voice_transcription: params.voiceTranscription,
      attachments: params.attachments ?? [],
      linked_order_id: params.linkedOrderId,
      linked_principle_id: params.linkedPrincipleId,
      sentiment,
      tags: params.tags ?? [],
      is_blocker: isBlocker,
      blocker_type: isBlocker ? detection.blockerType : null,
      blocker_severity: isBlocker ? detection.severity : null,
    })
    .returning();

  await indexMessage(params.userId, row!.id, text);

  let blockerLog = null;
  if (isBlocker && detection.blockerType) {
    blockerLog = await maybeLogBlocker({
      userId: params.userId,
      messageId: row!.id,
      content: text,
      blockerType: detection.blockerType,
      severity: detection.severity,
      linkedOrderId: params.linkedOrderId,
    });
  }

  return {
    message: mapMessage(row!),
    blockerDetection: detection,
    blockerLog,
  };
}

export async function recordVoiceMessage(params: {
  userId: string;
  voiceUrl: string;
  durationSeconds: number;
  transcription?: string;
  linkedOrderId?: string;
}) {
  const transcription =
    params.transcription ??
    `[Voice memo ${params.durationSeconds}s — configure Whisper for live transcription]`;

  const result = await createPersonalMessage({
    userId: params.userId,
    messageType: "voice",
    voiceUrl: params.voiceUrl,
    voiceDurationSeconds: params.durationSeconds,
    voiceTranscription: transcription,
    content: transcription,
    linkedOrderId: params.linkedOrderId,
  });

  await db.insert(chatVoiceMessages).values({
    message_id: result.message.id,
    user_id: params.userId,
    audio_file_url: params.voiceUrl,
    duration_seconds: params.durationSeconds,
    transcription,
    transcription_confidence: params.transcription ? 0.85 : 0.5,
    transcribed_at: new Date(),
  });

  return {
    ...result,
    voiceUrl: params.voiceUrl,
    transcription,
    confidence: params.transcription ? 0.85 : 0.5,
  };
}

export async function listMessages(params: {
  userId: string;
  limit?: number;
  offset?: number;
  messageType?: string;
  isBlocker?: boolean;
}) {
  const conditions = [eq(personalMessages.user_id, params.userId)];
  if (params.messageType) conditions.push(eq(personalMessages.message_type, params.messageType));
  if (params.isBlocker !== undefined) {
    conditions.push(eq(personalMessages.is_blocker, params.isBlocker));
  }

  const rows = await db
    .select()
    .from(personalMessages)
    .where(and(...conditions))
    .orderBy(desc(personalMessages.created_at))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);

  return rows.map(mapMessage);
}

export async function searchMessages(params: {
  userId: string;
  query: string;
  messageType?: string;
  isBlocker?: boolean;
  tags?: string[];
}) {
  const pattern = `%${params.query.replace(/%/g, "")}%`;

  const indexHits = await db
    .select({ message_id: messageSearchIndex.message_id })
    .from(messageSearchIndex)
    .where(
      and(
        eq(messageSearchIndex.user_id, params.userId),
        ilike(messageSearchIndex.searchable_text, pattern),
      ),
    )
    .limit(100);

  const ids = [...new Set(indexHits.map((h) => h.message_id))];
  if (!ids.length) {
    const fallback = await db
      .select()
      .from(personalMessages)
      .where(
        and(
          eq(personalMessages.user_id, params.userId),
          or(
            ilike(personalMessages.content, pattern),
            ilike(personalMessages.voice_transcription, pattern),
          ),
        ),
      )
      .orderBy(desc(personalMessages.created_at))
      .limit(50);
    return fallback.map(mapMessage);
  }

  const rows = await db
    .select()
    .from(personalMessages)
    .where(
      and(eq(personalMessages.user_id, params.userId), inArray(personalMessages.id, ids)),
    )
    .orderBy(desc(personalMessages.created_at));

  let results = rows.map(mapMessage);
  if (params.messageType) {
    results = results.filter((m) => m.messageType === params.messageType);
  }
  if (params.isBlocker !== undefined) {
    results = results.filter((m) => m.isBlocker === params.isBlocker);
  }
  if (params.tags?.length) {
    results = results.filter((m) =>
      params.tags!.some((t) => m.tags.includes(t)),
    );
  }
  return results;
}

export async function addAttachment(params: {
  userId: string;
  messageId: string;
  fileUrl: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
}) {
  const [msg] = await db
    .select()
    .from(personalMessages)
    .where(
      and(
        eq(personalMessages.id, params.messageId),
        eq(personalMessages.user_id, params.userId),
      ),
    )
    .limit(1);
  if (!msg) throw new Error("Message not found");

  const [att] = await db
    .insert(messageAttachments)
    .values({
      message_id: params.messageId,
      file_url: params.fileUrl,
      file_name: params.fileName,
      file_type: params.fileType,
      file_size: params.fileSize,
    })
    .returning();

  const attachments = [...((msg.attachments as string[]) ?? []), params.fileUrl];
  await db
    .update(personalMessages)
    .set({ attachments, updated_at: new Date() })
    .where(eq(personalMessages.id, params.messageId));

  return att;
}

export async function getBlockers(params: {
  userId: string;
  status?: string;
  minSeverity?: number;
}) {
  const conditions = [eq(blockerLogs.user_id, params.userId)];
  if (params.status) conditions.push(eq(blockerLogs.status, params.status));
  if (params.minSeverity) {
    conditions.push(gte(blockerLogs.severity, params.minSeverity));
  }

  return db
    .select()
    .from(blockerLogs)
    .where(and(...conditions))
    .orderBy(desc(blockerLogs.created_at));
}

export async function resolveBlocker(params: {
  userId: string;
  blockerId: string;
  resolutionNote?: string;
  resolutionDate?: string;
}) {
  const [existing] = await db
    .select()
    .from(blockerLogs)
    .where(and(eq(blockerLogs.id, params.blockerId), eq(blockerLogs.user_id, params.userId)))
    .limit(1);
  if (!existing) return null;

  const description = params.resolutionNote
    ? `${existing.description} — ${params.resolutionNote}`
    : existing.description;

  const [row] = await db
    .update(blockerLogs)
    .set({
      status: "resolved",
      resolution_date: params.resolutionDate ?? new Date().toISOString().slice(0, 10),
      description,
    })
    .where(eq(blockerLogs.id, params.blockerId))
    .returning();
  return row;
}

export async function saveStatusSnapshot(params: {
  userId: string;
  status: string;
  energy: number;
  clarity: number;
  momentum: number;
  notes?: string;
}) {
  const [prev] = await db
    .select()
    .from(statusSnapshots)
    .where(eq(statusSnapshots.user_id, params.userId))
    .orderBy(desc(statusSnapshots.created_at))
    .limit(1);

  const [snap] = await db
    .insert(statusSnapshots)
    .values({
      user_id: params.userId,
      status: params.status,
      energy: params.energy,
      clarity: params.clarity,
      momentum: params.momentum,
      notes: params.notes,
    })
    .returning();

  const content = `Status: ${params.status} · Energy ${params.energy}/10 · Clarity ${params.clarity}/10 · Momentum ${params.momentum}/10${params.notes ? ` — ${params.notes}` : ""}`;
  await createPersonalMessage({
    userId: params.userId,
    messageType: "status-update",
    content,
    tags: ["status"],
  });

  if (prev) {
    const energyDrop = prev.energy - params.energy;
    const clarityDrop = prev.clarity - params.clarity;
    if (energyDrop > 3 || clarityDrop > 3) {
      void routeAndSendNotification({
        userId: params.userId,
        notificationType: "status-change",
        title: "Execution energy dropped",
        body: `Energy or clarity fell significantly (${energyDrop > clarityDrop ? "energy" : "clarity"}). Consider recovery.`,
        priority: 3,
        channelsToSend: ["in-app", "push"],
      }).catch(() => undefined);
    }
  }

  return snap;
}

export function generateUploadUrl(userId: string, kind: "voice" | "file"): string {
  const id = crypto.randomUUID();
  return `https://storage.torgima.local/${userId}/${kind}/${id}`;
}
