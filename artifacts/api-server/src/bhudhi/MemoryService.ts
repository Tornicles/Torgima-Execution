import { db, bhudhiMemory } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { BhudhiMemoryService } from "./BhudhiMemoryService.js";
import { MemoryWriter } from "./MemoryWriter.js";

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

export async function retrieveMemory(params: {
  userId: string;
  blueprintId?: string;
  triggerType: BhudhiTriggerType;
}): Promise<string> {
  const records = await BhudhiMemoryService.retrieveForTrigger(params);
  return BhudhiMemoryService.summarizeForContext(records);
}

/** Returns memory record ids used for BhudhiLog attribution. */
export async function retrieveMemoryWithIds(params: {
  userId: string;
  blueprintId?: string;
  triggerType: BhudhiTriggerType;
}): Promise<{ summary: string; memoryIds: string[] }> {
  const records = await BhudhiMemoryService.retrieveForTrigger(params);
  return {
    summary: BhudhiMemoryService.summarizeForContext(records),
    memoryIds: records.map((r) => r.id),
  };
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
  if (params.sourceId) {
    await BhudhiMemoryService.writeMemory({
      userId: params.userId,
      blueprintId: params.blueprintId,
      memoryType: params.memoryType as Parameters<typeof BhudhiMemoryService.writeMemory>[0]["memoryType"],
      scope: params.scope,
      content: params.content,
      sourceType: params.sourceType as "FEEDBACK" | "ORDER" | "BHUDHI_OUTPUT" | "INACTIVITY" | "SYSTEM_SUMMARY",
      sourceId: params.sourceId,
      confidence: params.confidence,
      relevanceScore: params.relevanceScore,
    });
    return;
  }
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

export async function expireMemory(_userId: string, _blueprintId?: string): Promise<void> {
  await BhudhiMemoryService.expireOldMemory();
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
