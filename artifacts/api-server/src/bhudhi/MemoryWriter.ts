import { db, bhudhiMemory } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { MAX_MEMORY_CONTENT_CHARS } from "./memoryPolicy.js";

export type MemoryWriteSource =
  | "FEEDBACK"
  | "ORDER"
  | "BHUDHI_OUTPUT"
  | "INACTIVITY"
  | "SYSTEM_SUMMARY";

/** Approved memory writes only — not from Bhudhi model output paths. */
export const MemoryWriter = {
  async write(record: {
    userId: string;
    blueprintId?: string;
    memoryType: string;
    scope: string;
    content: string;
    sourceType: MemoryWriteSource | string;
    sourceId?: string;
    confidence: "LOW" | "MEDIUM" | "HIGH";
    relevanceScore?: number;
    expiresInDays?: number;
  }): Promise<void> {
    const forbidden = ["password", "token", "secret", "api_key", "credential", "private_note"];
    const lower = record.content.toLowerCase();
    if (forbidden.some((f) => lower.includes(f))) {
      logger.warn("[MemoryWriter] Rejected sensitive content in memory write");
      return;
    }

    let content = record.content;
    if (content.length > MAX_MEMORY_CONTENT_CHARS) {
      content = content.substring(0, MAX_MEMORY_CONTENT_CHARS) + "...";
    }

    const conf =
      record.confidence === "LOW" ? 0.35 : record.confidence === "MEDIUM" ? 0.6 : 0.85;

    const expiresAt = record.expiresInDays
      ? new Date(Date.now() + record.expiresInDays * 86400000)
      : null;

    await db.insert(bhudhiMemory).values({
      user_id: record.userId,
      blueprint_id: record.blueprintId,
      memory_type: record.memoryType,
      scope: record.scope,
      content,
      content_json: {
        text: content,
        scope: record.scope,
        source_type: record.sourceType,
        source_id: record.sourceId ?? null,
      },
      source_type: record.sourceType,
      source_id: record.sourceId,
      confidence: conf,
      relevance_score: record.relevanceScore ?? 0.5,
      expires_at: expiresAt,
      active: true,
    });
  },
};
