/**
 * BHUDHI_UPGRADE_PROMPT 1 — operational memory (CIS + KIS).
 */
import { db, bhudhiMemory, feedback, users } from "@workspace/db";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { allowedMemoryTypesForTrigger, MIN_RELEVANCE_SCORE } from "./memoryPolicy.js";
import { logger } from "../lib/logger.js";

export type MemoryType =
  | "USER_PREFERENCE"
  | "EXECUTION_PATTERN"
  | "FRICTION_PATTERN"
  | "CAPABILITY_NOTE"
  | "GOAL_CONTEXT"
  | "RECOVERY_CONTEXT"
  | "PROMPT_SUMMARY";

export interface BhudhiMemoryRecord {
  id: string;
  userId: string;
  blueprintId?: string;
  memoryType: MemoryType;
  scope: "USER" | "BLUEPRINT" | "ORDER" | "SESSION";
  content: string;
  sourceType: "FEEDBACK" | "ORDER" | "BHUDHI_OUTPUT" | "INACTIVITY" | "SYSTEM_SUMMARY";
  sourceId?: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  relevanceScore: number;
  expiresAt?: Date;
  disabledAt?: Date;
  createdAt: Date;
}

const MAX_CONTENT = 800;
const MAX_CONTEXT = 800;
const MAX_RETRIEVE = 5;

/** Tier-based memory depth (session / 7d / 30d). */
export const MEMORY_DEPTH_BY_TIER = {
  starter: { scope: "SESSION" as const, ttl_days: 0 },
  growth: { scope: "BLUEPRINT" as const, ttl_days: 7 },
  ultimate: { scope: "BLUEPRINT" as const, ttl_days: 30 },
} as const;

type UserTier = keyof typeof MEMORY_DEPTH_BY_TIER;

async function resolveUserTier(userId: string): Promise<UserTier> {
  const [row] = await db
    .select({ tier: users.tier })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const tier = row?.tier ?? "starter";
  if (tier === "growth" || tier === "ultimate") return tier;
  return "starter";
}

function expiresAtForTier(tier: UserTier): Date | null {
  const depth = MEMORY_DEPTH_BY_TIER[tier];
  if (depth.ttl_days <= 0) {
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    return end;
  }
  return new Date(Date.now() + depth.ttl_days * 86400000);
}

function scopeForTier(tier: UserTier): BhudhiMemoryRecord["scope"] {
  return tier === "starter" ? "SESSION" : "BLUEPRINT";
}

const CREDENTIAL_RE =
  /(?:api[_-]?key|password|secret|token|bearer\s|sk-[a-z0-9]{10,}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;

function confToNum(c: "LOW" | "MEDIUM" | "HIGH"): number {
  return c === "LOW" ? 0.35 : c === "MEDIUM" ? 0.6 : 0.85;
}

function numToConf(n: number): "LOW" | "MEDIUM" | "HIGH" {
  if (n < 0.45) return "LOW";
  if (n < 0.7) return "MEDIUM";
  return "HIGH";
}

function rowToRecord(row: typeof bhudhiMemory.$inferSelect): BhudhiMemoryRecord {
  const text =
    row.content?.trim() ||
    (typeof row.content_json === "object" &&
    row.content_json !== null &&
    "text" in row.content_json
      ? String((row.content_json as { text: unknown }).text ?? "")
      : "");
  return {
    id: row.id,
    userId: row.user_id,
    blueprintId: row.blueprint_id ?? undefined,
    memoryType: row.memory_type as MemoryType,
    scope: (row.scope as BhudhiMemoryRecord["scope"]) ?? "BLUEPRINT",
    content: text.slice(0, MAX_CONTENT),
    sourceType: (row.source_type as BhudhiMemoryRecord["sourceType"]) ?? "SYSTEM_SUMMARY",
    sourceId: row.source_id ?? undefined,
    confidence: numToConf(row.confidence),
    relevanceScore: row.relevance_score,
    expiresAt: row.expires_at ?? undefined,
    disabledAt: row.disabled_at ?? undefined,
    createdAt: row.created_at,
  };
}

function sanitizeContent(content: string): string | null {
  if (CREDENTIAL_RE.test(content)) {
    logger.warn("[BhudhiMemoryService] Rejected memory content with credential pattern");
    return null;
  }
  return content.length > MAX_CONTENT ? `${content.slice(0, MAX_CONTENT - 3)}...` : content;
}

function expiryDaysForType(memoryType: MemoryType, tier: UserTier): number | undefined {
  const tierCap = MEMORY_DEPTH_BY_TIER[tier].ttl_days;
  if (tierCap === 0) return 0;
  if (memoryType === "PROMPT_SUMMARY") return Math.min(90, tierCap);
  if (memoryType === "FRICTION_PATTERN") return Math.min(180, tierCap);
  if (memoryType === "USER_PREFERENCE" || memoryType === "GOAL_CONTEXT") return tierCap;
  return tierCap;
}

export const BhudhiMemoryService = {
  async retrieveForTrigger(params: {
    userId: string;
    blueprintId?: string;
    triggerType: BhudhiTriggerType | string;
  }): Promise<BhudhiMemoryRecord[]> {
    const allowed = allowedMemoryTypesForTrigger(params.triggerType);
    if (allowed.length === 0) return [];

    const scopeOr = params.blueprintId
      ? or(eq(bhudhiMemory.blueprint_id, params.blueprintId), isNull(bhudhiMemory.blueprint_id))
      : sql`true`;

    const rows = await db
      .select()
      .from(bhudhiMemory)
      .where(
        and(
          eq(bhudhiMemory.user_id, params.userId),
          inArray(bhudhiMemory.memory_type, allowed),
          eq(bhudhiMemory.active, true),
          isNull(bhudhiMemory.disabled_at),
          gt(bhudhiMemory.relevance_score, MIN_RELEVANCE_SCORE),
          or(isNull(bhudhiMemory.expires_at), gt(bhudhiMemory.expires_at, new Date())),
          scopeOr,
        ),
      )
      .orderBy(
        desc(bhudhiMemory.relevance_score),
        desc(bhudhiMemory.confidence),
        desc(bhudhiMemory.updated_at),
      )
      .limit(MAX_RETRIEVE);

    const ranked = rows
      .map(rowToRecord)
      .filter((r) => !CREDENTIAL_RE.test(r.content))
      .sort((a, b) => {
        const bp = params.blueprintId && a.blueprintId === params.blueprintId ? 2 : 0;
        const bbp = params.blueprintId && b.blueprintId === params.blueprintId ? 2 : 0;
        return bbp + b.relevanceScore - (bp + a.relevanceScore);
      });

    return ranked.slice(0, MAX_RETRIEVE);
  },

  summarizeForContext(records: BhudhiMemoryRecord[]): string {
    if (!records.length) return "";
    const pref = records.find((r) => r.memoryType === "USER_PREFERENCE")?.content;
    const pattern = records.find(
      (r) => r.memoryType === "EXECUTION_PATTERN" || r.memoryType === "FRICTION_PATTERN",
    )?.content;
    const cap = records.find((r) => r.memoryType === "CAPABILITY_NOTE")?.content;
    const goal = records.find((r) => r.memoryType === "GOAL_CONTEXT")?.content;
    const recovery = records.find((r) => r.memoryType === "RECOVERY_CONTEXT")?.content;

    const lines = ["[Memory context]"];
    if (pref) lines.push(`- Preference: ${pref}`);
    if (pattern) lines.push(`- Pattern: ${pattern}`);
    if (cap) lines.push(`- Capability: ${cap}`);
    if (goal) lines.push(`- Goal: ${goal}`);
    if (recovery) lines.push(`- Recovery: ${recovery}`);

    const out = lines.join("\n");
    return out.length > MAX_CONTEXT ? `${out.slice(0, MAX_CONTEXT - 3)}...` : out;
  },

  async writeMemory(params: {
    userId: string;
    blueprintId?: string;
    memoryType: MemoryType;
    scope: BhudhiMemoryRecord["scope"];
    content: string;
    sourceType: BhudhiMemoryRecord["sourceType"];
    sourceId: string;
    confidence: "LOW" | "MEDIUM" | "HIGH";
    relevanceScore?: number;
  }): Promise<string | null> {
    if (!params.sourceId) {
      logger.warn("[BhudhiMemoryService] Rejected orphaned memory write");
      return null;
    }

    const content = sanitizeContent(params.content);
    if (!content) return null;

    const tier = await resolveUserTier(params.userId);
    const tierScope = scopeForTier(tier);
    const effectiveScope = tier === "starter" ? tierScope : params.scope;

    const expiresInDays = expiryDaysForType(params.memoryType, tier);
    const expiresAt =
      expiresInDays === 0
        ? expiresAtForTier(tier)
        : expiresInDays
          ? new Date(Date.now() + expiresInDays * 86400000)
          : expiresAtForTier(tier);

    const [existing] = await db
      .select({ id: bhudhiMemory.id })
      .from(bhudhiMemory)
      .where(
        and(
          eq(bhudhiMemory.user_id, params.userId),
          eq(bhudhiMemory.memory_type, params.memoryType),
          eq(bhudhiMemory.scope, effectiveScope),
          params.blueprintId
            ? eq(bhudhiMemory.blueprint_id, params.blueprintId)
            : isNull(bhudhiMemory.blueprint_id),
          eq(bhudhiMemory.active, true),
          isNull(bhudhiMemory.disabled_at),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(bhudhiMemory)
        .set({
          content,
          content_json: { text: content, source_id: params.sourceId },
          source_type: params.sourceType,
          source_id: params.sourceId,
          confidence: confToNum(params.confidence),
          relevance_score: params.relevanceScore ?? 0.6,
          expires_at: expiresAt,
          reinforcement_count: sql`${bhudhiMemory.reinforcement_count} + 1`,
          last_reinforced_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(bhudhiMemory.id, existing.id));
      return existing.id;
    }

    const [row] = await db
      .insert(bhudhiMemory)
      .values({
        user_id: params.userId,
        blueprint_id: params.blueprintId,
        memory_type: params.memoryType,
        scope: effectiveScope,
        content,
        content_json: { text: content, source_id: params.sourceId },
        source_type: params.sourceType,
        source_id: params.sourceId,
        confidence: confToNum(params.confidence),
        relevance_score: params.relevanceScore ?? 0.5,
        expires_at: expiresAt,
        active: true,
      })
      .returning({ id: bhudhiMemory.id });

    return row?.id ?? null;
  },

  /** Starter-tier session memory — purge on logout. */
  async clearSessionScopeForUser(userId: string): Promise<number> {
    const result = await db
      .update(bhudhiMemory)
      .set({ active: false, disabled_at: new Date(), updated_at: new Date() })
      .where(
        and(
          eq(bhudhiMemory.user_id, userId),
          eq(bhudhiMemory.scope, "SESSION"),
          eq(bhudhiMemory.active, true),
          isNull(bhudhiMemory.disabled_at),
        ),
      )
      .returning({ id: bhudhiMemory.id });
    if (result.length > 0) {
      logger.info({ userId, count: result.length }, "[BhudhiMemoryService] Cleared session-scope memory");
    }
    return result.length;
  },

  async expireOldMemory(): Promise<number> {
    const result = await db
      .update(bhudhiMemory)
      .set({ active: false, disabled_at: new Date(), updated_at: new Date() })
      .where(
        and(
          isNull(bhudhiMemory.disabled_at),
          sql`${bhudhiMemory.expires_at} IS NOT NULL`,
          sql`${bhudhiMemory.expires_at} < now()`,
        ),
      )
      .returning({ id: bhudhiMemory.id });
    return result.length;
  },

  async buildMemoryCandidateFromFeedback(params: {
    userId: string;
    blueprintId: string;
    feedbackId: string;
    completionStatus: string;
    score: number;
    reflection?: string;
    hadBlocker?: boolean;
    confidenceLabel?: string;
  }): Promise<string[]> {
    const ids: string[] = [];
    const verdictOk = ["completed", "partial"].includes(params.completionStatus);
    if (!verdictOk) return ids;

    const reflection = (params.reflection ?? "").trim();

    if (params.hadBlocker && reflection.length > 10) {
      const id = await this.writeMemory({
        userId: params.userId,
        blueprintId: params.blueprintId,
        memoryType: "FRICTION_PATTERN",
        scope: "BLUEPRINT",
        content: `Friction noted: ${reflection.slice(0, 400)}`,
        sourceType: "FEEDBACK",
        sourceId: params.feedbackId,
        confidence: "MEDIUM",
        relevanceScore: 0.7,
      });
      if (id) ids.push(id);
    }

    if (params.completionStatus === "failed" && reflection.length > 5) {
      const id = await this.writeMemory({
        userId: params.userId,
        blueprintId: params.blueprintId,
        memoryType: "FRICTION_PATTERN",
        scope: "BLUEPRINT",
        content: `Failed execution: ${reflection.slice(0, 400)}`,
        sourceType: "FEEDBACK",
        sourceId: params.feedbackId,
        confidence: "MEDIUM",
        relevanceScore: 0.65,
      });
      if (id) ids.push(id);
    }

    const recent = await db
      .select({ score: feedback.score, confidence_score: feedback.confidence_score })
      .from(feedback)
      .where(
        and(eq(feedback.user_id, params.userId), eq(feedback.blueprint_id, params.blueprintId)),
      )
      .orderBy(desc(feedback.created_at))
      .limit(3);

    if (recent.length >= 3 && recent.every((r) => (r.score ?? 10) < 4)) {
      const id = await this.writeMemory({
        userId: params.userId,
        blueprintId: params.blueprintId,
        memoryType: "EXECUTION_PATTERN",
        scope: "BLUEPRINT",
        content: "Repeated low scores (under 4) across last 3 feedback submissions.",
        sourceType: "FEEDBACK",
        sourceId: params.feedbackId,
        confidence: "HIGH",
        relevanceScore: 0.75,
      });
      if (id) ids.push(id);
    }

    const lowConfCount = recent.filter((r) => (r.confidence_score ?? 1) < 0.4).length;
    if (lowConfCount >= 2 || params.confidenceLabel === "LOW") {
      const id = await this.writeMemory({
        userId: params.userId,
        blueprintId: params.blueprintId,
        memoryType: "EXECUTION_PATTERN",
        scope: "BLUEPRINT",
        content: "Low confidence pattern in recent feedback — clarify proof and expectations.",
        sourceType: "FEEDBACK",
        sourceId: params.feedbackId,
        confidence: "MEDIUM",
        relevanceScore: 0.6,
      });
      if (id) ids.push(id);
    }

    return ids;
  },
};
