import { db, bhudhiMemory } from "@workspace/db";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import type { BhudhiTriggerType } from "../types/bhudhi.js";

const MAX_MEMORY_RECORDS = 5;
const MAX_MEMORY_CHARS   = 800;

type MemoryType =
  | "USER_PREFERENCE"
  | "EXECUTION_PATTERN"
  | "FRICTION_PATTERN"
  | "CAPABILITY_NOTE"
  | "GOAL_CONTEXT"
  | "RECOVERY_CONTEXT"
  | "PROMPT_SUMMARY";

const TRIGGER_MEMORY_MAP: Record<BhudhiTriggerType, MemoryType[]> = {
  GOAL_STRUCTURING:         ["GOAL_CONTEXT", "USER_PREFERENCE"],
  REALITY_INTELLIGENCE:     ["GOAL_CONTEXT"],
  TASK_DRAFTING:            ["USER_PREFERENCE", "CAPABILITY_NOTE"],
  FEEDBACK_CLASSIFICATION:  ["FRICTION_PATTERN"],
  CLARIFICATION_PROMPT:     [],
  RECOVERY_COPY:            ["RECOVERY_CONTEXT", "FRICTION_PATTERN"],
  STATE_EXPLANATION:        ["EXECUTION_PATTERN", "GOAL_CONTEXT"],
  INACTIVITY_RESTART:       ["RECOVERY_CONTEXT", "EXECUTION_PATTERN"],
  ACADEMY_SUPPORT:          ["CAPABILITY_NOTE"],
  OUTCOME_EVIDENCE_SUMMARY: ["GOAL_CONTEXT"],
  ROOT_CAUSE_ASSIST:        ["EXECUTION_PATTERN", "FRICTION_PATTERN"],
};

function memoryText(contentJson: unknown): string {
  if (typeof contentJson === "object" && contentJson !== null && "text" in contentJson) {
    return String((contentJson as { text: unknown }).text ?? "");
  }
  return typeof contentJson === "string" ? contentJson : JSON.stringify(contentJson);
}

export async function retrieveMemory(params: {
  userId:      string;
  blueprintId?: string;
  triggerType: BhudhiTriggerType;
}): Promise<string> {

  const allowedTypes = TRIGGER_MEMORY_MAP[params.triggerType] ?? [];
  if (allowedTypes.length === 0) return "";

  const scopeOr = params.blueprintId
    ? or(eq(bhudhiMemory.blueprint_id, params.blueprintId), isNull(bhudhiMemory.blueprint_id))
    : sql`true`;

  const records = await db
    .select()
    .from(bhudhiMemory)
    .where(
      and(
        eq(bhudhiMemory.user_id, params.userId),
        inArray(bhudhiMemory.memory_type, allowedTypes),
        eq(bhudhiMemory.active, true),
        or(isNull(bhudhiMemory.expires_at), gt(bhudhiMemory.expires_at, new Date())),
        scopeOr,
      ),
    )
    .orderBy(desc(bhudhiMemory.confidence), desc(bhudhiMemory.created_at))
    .limit(MAX_MEMORY_RECORDS);

  if (records.length === 0) return "";

  const summary = records
    .map(r => `[${r.memory_type}] ${memoryText(r.content_json)}`)
    .join("\n");

  if (summary.length > MAX_MEMORY_CHARS) {
    throw new Error("[MemoryService] Memory context exceeds 800 characters");
  }

  return summary;
}

export async function writeMemory(params: {
  userId:       string;
  blueprintId?: string;
  memoryType:   MemoryType;
  scope:        "USER" | "BLUEPRINT" | "ORDER" | "SESSION";
  content:      string;
  sourceType:   string;
  sourceId?:    string;
  confidence:   "LOW" | "MEDIUM" | "HIGH";
  expiresInDays?: number;
}): Promise<void> {

  const forbidden = ["password", "token", "secret", "api_key", "credential"];
  if (forbidden.some(f => params.content.toLowerCase().includes(f))) {
    logger.warn("[MemoryService] Rejected sensitive content in memory write");
    return;
  }

  const conf =
    params.confidence === "LOW" ? 0.35 : params.confidence === "MEDIUM" ? 0.6 : 0.85;

  const expiresAt = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 24 * 3600000)
    : undefined;

  const payload = {
    text: params.content.slice(0, 1000),
    scope: params.scope,
    source_type: params.sourceType,
    source_id: params.sourceId ?? null,
  };

  await db.insert(bhudhiMemory).values({
    user_id:       params.userId,
    blueprint_id:  params.blueprintId,
    memory_type:   params.memoryType,
    content_json:  payload,
    confidence:    conf,
    expires_at:    expiresAt,
    active:        true,
  });
}

export async function expireMemory(userId: string, blueprintId?: string): Promise<void> {
  await db
    .update(bhudhiMemory)
    .set({ active: false, updated_at: new Date() })
    .where(
      and(
        eq(bhudhiMemory.user_id, userId),
        blueprintId ? eq(bhudhiMemory.blueprint_id, blueprintId) : sql`true`,
      ),
    );
}

/** Deactivate all blueprint-scoped Bhudhi rows after completion / pivot (spec Prompt 12). */
export async function deactivateBlueprintBhudhiMemory(userId: string, blueprintId: string): Promise<void> {
  await db
    .update(bhudhiMemory)
    .set({ active: false, updated_at: new Date() })
    .where(and(eq(bhudhiMemory.user_id, userId), eq(bhudhiMemory.blueprint_id, blueprintId)));
}
