import { db, bhudhiMemory } from "@workspace/db";
import { and, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { logger } from "../logger.js";
import type { Doc12TriggerType } from "./TriggerRegistry.js";

/** DOC14 allowed memory types and default expiry (days). */
export const DOC14_MEMORY_TYPES = {
  user_goal_summary: 30,
  recent_task_context: 7,
  friction_summary: 3,
  capability_summary: 14,
  recovery_context: 7,
  pattern_summary: 7,
} as const;

export type Doc14MemoryType = keyof typeof DOC14_MEMORY_TYPES;

/** DOC14 injection rules — triggers with no entry receive no memory. */
export const TRIGGER_MEMORY_INJECTION: Partial<Record<Doc12TriggerType, Doc14MemoryType[]>> = {
  TASK_DRAFTING: ["user_goal_summary", "recent_task_context"],
  RECOVERY_COPY: ["recovery_context", "friction_summary"],
  ACADEMY_SUPPORT: ["capability_summary"],
  STATE_EXPLANATION: ["pattern_summary"],
  GOAL_STRUCTURING: [],
  BLOCKER_CLASSIFICATION: [],
  PROOF_RELEVANCE_CHECK: [],
  CLARIFICATION_PROMPT: [],
  OUTCOME_EVIDENCE_SUMMARY: [],
  ROOT_CAUSE_ASSIST: [],
};

const MAX_SUMMARY_CHARS = 200;

const CREDENTIAL_RE =
  /(?:api[_-]?key|password|secret|token|bearer\s|sk-[a-z0-9]{10,})/i;

export function summarizeMemory(content: Record<string, unknown>): string {
  const preferred =
    content.summary ??
    content.text ??
    content.message ??
    content.headline ??
    content.reason ??
    content.goal;

  let text: string;
  if (typeof preferred === "string" && preferred.trim()) {
    text = preferred.trim();
  } else {
    const parts: string[] = [];
    for (const value of Object.values(content)) {
      if (typeof value === "string" && value.trim()) parts.push(value.trim());
      if (parts.join(" ").length >= MAX_SUMMARY_CHARS) break;
    }
    text = parts.join(" ").trim() || "Context note";
  }

  if (text.startsWith("{") || text.startsWith("[")) {
    text = "Summarized execution context";
  }

  return text.length > MAX_SUMMARY_CHARS ? `${text.slice(0, MAX_SUMMARY_CHARS - 3)}...` : text;
}

function expiryDate(days: number): Date {
  return new Date(Date.now() + days * 86400000);
}

export class BhudhiMemoryService {
  async upsert(
    userId: string,
    blueprintId: string,
    memoryType: string,
    content: Record<string, unknown>,
    expiryDays: number,
  ): Promise<void> {
    if (!(memoryType in DOC14_MEMORY_TYPES)) {
      logger.warn({ memoryType }, "[BhudhiMemoryService] Rejected unknown memory type");
      return;
    }

    const summary = summarizeMemory(content);
    if (CREDENTIAL_RE.test(summary)) {
      logger.warn({ memoryType }, "[BhudhiMemoryService] Rejected memory with credential pattern");
      return;
    }

    const expiresAt = expiryDate(expiryDays);
    const [existing] = await db
      .select({ id: bhudhiMemory.id })
      .from(bhudhiMemory)
      .where(
        and(
          eq(bhudhiMemory.user_id, userId),
          eq(bhudhiMemory.blueprint_id, blueprintId),
          eq(bhudhiMemory.memory_type, memoryType),
          eq(bhudhiMemory.active, true),
          isNull(bhudhiMemory.disabled_at),
        ),
      )
      .limit(1);

    const payload = {
      content: summary,
      content_json: { ...content, summary },
      source_type: "SYSTEM_SUMMARY",
      source_id: blueprintId,
      expires_at: expiresAt,
      updated_at: new Date(),
    };

    if (existing) {
      await db
        .update(bhudhiMemory)
        .set({
          ...payload,
          reinforcement_count: sql`${bhudhiMemory.reinforcement_count} + 1`,
          last_reinforced_at: new Date(),
        })
        .where(eq(bhudhiMemory.id, existing.id));
      return;
    }

    await db.insert(bhudhiMemory).values({
      user_id: userId,
      blueprint_id: blueprintId,
      memory_type: memoryType,
      scope: "BLUEPRINT",
      confidence: 0.6,
      relevance_score: 0.6,
      active: true,
      ...payload,
    });
  }

  async loadForTrigger(
    userId: string,
    blueprintId: string,
    triggerType: string,
  ): Promise<Record<string, unknown>> {
    const allowed = TRIGGER_MEMORY_INJECTION[triggerType as Doc12TriggerType];
    if (!allowed || allowed.length === 0) return {};

    const rows = await db
      .select({
        memory_type: bhudhiMemory.memory_type,
        content: bhudhiMemory.content,
        content_json: bhudhiMemory.content_json,
      })
      .from(bhudhiMemory)
      .where(
        and(
          eq(bhudhiMemory.user_id, userId),
          eq(bhudhiMemory.blueprint_id, blueprintId),
          inArray(bhudhiMemory.memory_type, allowed),
          eq(bhudhiMemory.active, true),
          isNull(bhudhiMemory.disabled_at),
          or(isNull(bhudhiMemory.expires_at), gt(bhudhiMemory.expires_at, new Date())),
        ),
      );

    const memory: Record<string, unknown> = {};
    for (const row of rows) {
      const type = row.memory_type as Doc14MemoryType;
      if (!allowed.includes(type)) continue;
      const json =
        row.content_json && typeof row.content_json === "object"
          ? (row.content_json as Record<string, unknown>)
          : { summary: row.content ?? "" };
      memory[type] = summarizeMemory(json);
    }

    return memory;
  }

  /** Nightly cleanup — hard-delete expired DOC14 memory rows. */
  async runDecayCleanup(): Promise<number> {
    const types = Object.keys(DOC14_MEMORY_TYPES);
    const result = await db
      .delete(bhudhiMemory)
      .where(
        and(
          inArray(bhudhiMemory.memory_type, types),
          sql`${bhudhiMemory.expires_at} IS NOT NULL`,
          lt(bhudhiMemory.expires_at, new Date()),
        ),
      )
      .returning({ id: bhudhiMemory.id });

    if (result.length > 0) {
      logger.info({ count: result.length }, "[BhudhiMemoryService] Decay cleanup deleted expired memory");
    }
    return result.length;
  }
}

export const bhudhiMemoryService = new BhudhiMemoryService();
