import { db, bhudhiMemory } from "@workspace/db";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { MemoryWriter } from "./MemoryWriter.js";
import {
  allowedMemoryTypesForTrigger,
  MAX_MEMORY_ITEMS_PER_CALL,
  MIN_RELEVANCE_SCORE,
} from "./memoryPolicy.js";

type MemoryType =
  | "USER_PREFERENCE"
  | "EXECUTION_PATTERN"
  | "FRICTION_PATTERN"
  | "CAPABILITY_NOTE"
  | "SKILL_PROGRESSION"
  | "LEARNING_STYLE"
  | "GOAL_CONTEXT"
  | "RECOVERY_CONTEXT"
  | "KNOWLEDGE_ACCESSED"
  | "PROMPT_SUMMARY";

const MAX_MEMORY_CHARS = 800;

function memoryText(row: { content: string | null; content_json: unknown }): string {
  if (row.content?.trim()) return row.content.trim();
  if (typeof row.content_json === "object" && row.content_json !== null && "text" in row.content_json) {
    return String((row.content_json as { text: unknown }).text ?? "");
  }
  return typeof row.content_json === "string" ? row.content_json : JSON.stringify(row.content_json);
}

export async function retrieveMemory(params: {
  userId: string;
  blueprintId?: string;
  triggerType: BhudhiTriggerType;
}): Promise<string> {
  const allowedTypes = allowedMemoryTypesForTrigger(params.triggerType);
  if (allowedTypes.length === 0) return "";

  const scopeOr = params.blueprintId
    ? or(eq(bhudhiMemory.blueprint_id, params.blueprintId), isNull(bhudhiMemory.blueprint_id))
    : sql`true`;

  const records = await db
    .select({
      memory_type: bhudhiMemory.memory_type,
      content: bhudhiMemory.content,
      content_json: bhudhiMemory.content_json,
    })
    .from(bhudhiMemory)
    .where(
      and(
        eq(bhudhiMemory.user_id, params.userId),
        inArray(bhudhiMemory.memory_type, allowedTypes),
        eq(bhudhiMemory.active, true),
        isNull(bhudhiMemory.disabled_at),
        gt(bhudhiMemory.relevance_score, MIN_RELEVANCE_SCORE),
        or(isNull(bhudhiMemory.expires_at), gt(bhudhiMemory.expires_at, new Date())),
        scopeOr,
      ),
    )
    .orderBy(desc(bhudhiMemory.relevance_score), desc(bhudhiMemory.confidence))
    .limit(MAX_MEMORY_ITEMS_PER_CALL);

  if (records.length === 0) return "";

  const summary = records.map((r) => memoryText(r)).join(" | ");
  if (summary.length > MAX_MEMORY_CHARS) {
    return summary.slice(0, MAX_MEMORY_CHARS);
  }
  return summary;
}

/** @deprecated Prefer MemoryWriter.write from approved engines. */
export async function writeMemory(params: {
  userId: string;
  blueprintId?: string;
  memoryType: MemoryType;
  scope: "USER" | "BLUEPRINT" | "ORDER" | "SESSION";
  content: string;
  sourceType: string;
  sourceId?: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  expiresInDays?: number;
  relevanceScore?: number;
}): Promise<void> {
  await MemoryWriter.write({
    userId: params.userId,
    blueprintId: params.blueprintId,
    memoryType: params.memoryType,
    scope: params.scope,
    content: params.content,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    confidence: params.confidence,
    relevanceScore: params.relevanceScore,
    expiresInDays: params.expiresInDays,
  });
}

export async function expireMemory(userId: string, blueprintId?: string): Promise<void> {
  await db
    .update(bhudhiMemory)
    .set({ active: false, disabled_at: new Date(), updated_at: new Date() })
    .where(
      and(
        eq(bhudhiMemory.user_id, userId),
        blueprintId ? eq(bhudhiMemory.blueprint_id, blueprintId) : sql`true`,
      ),
    );
}

export async function deactivateBlueprintBhudhiMemory(
  userId: string,
  blueprintId: string,
): Promise<void> {
  await db
    .update(bhudhiMemory)
    .set({ active: false, disabled_at: new Date(), updated_at: new Date() })
    .where(and(eq(bhudhiMemory.user_id, userId), eq(bhudhiMemory.blueprint_id, blueprintId)));
}
