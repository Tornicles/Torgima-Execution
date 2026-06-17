import { db, bhudhiLogs, bhudhiUsageBudget, users } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { BudgetController } from "../lib/bhudhi/BudgetController.js";
import { logger } from "../lib/logger.js";
import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { mapBhudhiTriggerToDbEnum, mapBhudhiTriggerToRequestType } from "./bhudhiLogMapping.js";
import { ERECTOR_SEARCH_TRIGGERS } from "./bhudhiProviders.js";
import type { BhudhiProvider } from "./bhudhiProviders.js";
import { modelIdForProvider } from "./bhudhiProviders.js";

const DAILY_TOKEN_LIMIT = parseInt(process.env.BHUDHI_DAILY_TOKEN_LIMIT ?? "100000", 10);

const TRIGGER_MAX_TOKENS: Record<string, number> = {
  GOAL_STRUCTURING: 600,
  TASK_DRAFTING: 500,
  TASK_CLARIFICATION: 300,
  RECOVERY_COPY: 400,
  FEEDBACK_CLASSIFICATION: 300,
  STATE_EXPLANATION: 600,
  OUTCOME_EVIDENCE_SUMMARY: 500,
  ACADEMY_SUPPORT: 700,
  ROOT_CAUSE_ASSIST: 500,
  CLARIFICATION_PROMPT: 300,
  PROOF_RELEVANCE_CHECK: 200,
  BLOCKER_CLASSIFICATION: 300,
  INACTIVITY_RESTART: 400,
};

/** Minimum daily AI call cap (Erector validation uses many Bhudhi/web-search calls). Override via Worker secret: BHUDHI_DAILY_CAP=200 */
const BHUDHI_DAILY_CAP = parseInt(process.env.BHUDHI_DAILY_CAP ?? "200", 10);

const DAILY_CAPS: Record<string, { maxCalls: number; maxCostCents: number }> = {
  starter: { maxCalls: 20, maxCostCents: 5 },
  growth: { maxCalls: 50, maxCostCents: 20 },
  ultimate: { maxCalls: 100, maxCostCents: 75 },
};

function dailyCallCapForTier(tier: string): number {
  const tierCap = DAILY_CAPS[tier]?.maxCalls ?? DAILY_CAPS.starter!.maxCalls;
  return Math.max(tierCap, BHUDHI_DAILY_CAP);
}

function todayUtc(): string {
  return new Date().toISOString().split("T")[0]!;
}

async function checkUsageBudgetRow(
  userId: string,
  tier: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const caps = DAILY_CAPS[tier] ?? DAILY_CAPS.starter!;
  const today = todayUtc();
  try {
    const [budget] = await db
      .select()
      .from(bhudhiUsageBudget)
      .where(and(eq(bhudhiUsageBudget.user_id, userId), eq(bhudhiUsageBudget.date_utc, today)))
      .limit(1);

    if (budget?.budget_exhausted) {
      return { allowed: false, reason: "BUDGET_EXHAUSTED" };
    }
    if ((budget?.total_calls ?? 0) >= caps.maxCalls) {
      return { allowed: false, reason: "CALL_CAP" };
    }
    if ((budget?.total_cost_cents ?? 0) >= caps.maxCostCents) {
      return { allowed: false, reason: "COST_CAP" };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export async function incrementUsageBudget(params: {
  userId: string;
  triggerType: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}): Promise<void> {
  const [user] = await db
    .select({ tier: users.tier })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);
  const tier = user?.tier ?? "starter";
  const today = todayUtc();
  const costCents = params.costUsd * 100;

  const [existing] = await db
    .select()
    .from(bhudhiUsageBudget)
    .where(and(eq(bhudhiUsageBudget.user_id, params.userId), eq(bhudhiUsageBudget.date_utc, today)))
    .limit(1);

  const caps = DAILY_CAPS[tier] ?? DAILY_CAPS.starter!;
  const callsByTrigger =
    existing?.calls_by_trigger && typeof existing.calls_by_trigger === "object"
      ? { ...(existing.calls_by_trigger as Record<string, number>) }
      : {};
  callsByTrigger[params.triggerType] = (callsByTrigger[params.triggerType] ?? 0) + 1;

  const totalCalls = (existing?.total_calls ?? 0) + 1;
  const totalCostCents = (existing?.total_cost_cents ?? 0) + costCents;
  const budgetExhausted =
    totalCalls >= caps.maxCalls || totalCostCents >= caps.maxCostCents;

  if (existing) {
    await db
      .update(bhudhiUsageBudget)
      .set({
        total_calls: totalCalls,
        total_input_tokens: (existing.total_input_tokens ?? 0) + params.inputTokens,
        total_output_tokens: (existing.total_output_tokens ?? 0) + params.outputTokens,
        total_cost_cents: totalCostCents,
        calls_by_trigger: callsByTrigger,
        budget_exhausted: budgetExhausted,
        updated_at: new Date(),
      })
      .where(eq(bhudhiUsageBudget.id, existing.id));
  } else {
    await db.insert(bhudhiUsageBudget).values({
      user_id: params.userId,
      date_utc: today,
      tier,
      total_calls: 1,
      total_input_tokens: params.inputTokens,
      total_output_tokens: params.outputTokens,
      total_cost_cents: costCents,
      calls_by_trigger: callsByTrigger,
      budget_exhausted: budgetExhausted,
    });
  }
}

const TIMEOUT_MS = 30_000;
const TASK_TIMEOUT_MS = 5000;

function estimatedCostUsd(inputTokens: number, outputTokens: number): number {
  return inputTokens * 0.000003 + outputTokens * 0.000015;
}

export function getMaxTokensForTrigger(triggerType: string): number {
  return TRIGGER_MAX_TOKENS[triggerType] ?? 500;
}

export async function checkTokenBudget(userId: string): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    const [{ total }] = await db
      .select({
        total: sql<number>`coalesce(sum(${bhudhiLogs.token_count_in}), 0)::int`,
      })
      .from(bhudhiLogs)
      .where(and(eq(bhudhiLogs.user_id, userId), gte(bhudhiLogs.created_at, todayStart)));

    return Number(total ?? 0) < DAILY_TOKEN_LIMIT;
  } catch {
    return true;
  }
}

export const UsageController = {
  check: (userId: string, _triggerType?: string) => checkTokenBudget(userId),
  getMaxTokens: getMaxTokensForTrigger,
  async record(
    _userId: string,
    _triggerType: string,
    _usage: { inputTokens: number; outputTokens: number; latencyMs: number },
  ): Promise<void> {
    // Logged via logUsage / updateBhudhiLog in BhudhiCore.
  },
};

export async function checkUsageAllowed(params: {
  userId: string;
  triggerType: string;
}): Promise<{ allowed: boolean; reason?: string }> {
  const tokenOk = await checkTokenBudget(params.userId);
  if (!tokenOk) {
    logger.warn({ userId: params.userId }, "[UsageController] Daily token budget exhausted");
    return {
      allowed: false,
      reason: `Daily token budget exhausted (${DAILY_TOKEN_LIMIT} input tokens)`,
    };
  }

  let tier = "starter";
  try {
    const [user] = await db
      .select({ tier: users.tier })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1);
    tier = user?.tier ?? "starter";
  } catch {
    return { allowed: true };
  }

  const budgetCheck = await checkUsageBudgetRow(params.userId, tier);
  if (!budgetCheck.allowed) {
    return budgetCheck;
  }

  const dailyCap = dailyCallCapForTier(tier);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let todayCount = 0;
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bhudhiLogs)
      .where(and(eq(bhudhiLogs.user_id, params.userId), gte(bhudhiLogs.created_at, todayStart)));
    todayCount = count ?? 0;
  } catch {
    return { allowed: true };
  }

  if (todayCount >= dailyCap) {
    logger.warn(
      { userId: params.userId, tier, cap: dailyCap, used: todayCount },
      "[UsageController] Daily call cap reached",
    );
    return {
      allowed: false,
      reason: `Daily AI call limit reached (${dailyCap} calls for ${tier} tier)`,
    };
  }

  void params.triggerType;
  return { allowed: true };
}

export function getTimeout(triggerType: string): number {
  if (triggerType === "TASK_DRAFTING") return TASK_TIMEOUT_MS;
  if (
    triggerType === "REALITY_INTELLIGENCE" ||
    triggerType === "EIS_INDUSTRY_RESEARCH" ||
    ERECTOR_SEARCH_TRIGGERS.has(triggerType as never)
  ) {
    return 75_000;
  }
  if (triggerType.startsWith("ERECTOR_")) return 45_000;
  return TIMEOUT_MS;
}

export async function logUsage(params: {
  userId: string;
  blueprintId?: string;
  triggerType: BhudhiTriggerType | string;
  sourceEngine?: string;
  promptName: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: "success" | "fallback" | "error" | "rejected" | "pending";
  fallbackReason?: string;
  errorCode?: string;
  provider?: BhudhiProvider;
  memoryIdsUsed?: string[];
  memoryWriteIds?: string[];
}): Promise<string> {
  const cost = estimatedCostUsd(params.inputTokens, params.outputTokens);
  const provider = params.provider ?? "claude";

  const [row] = await db
    .insert(bhudhiLogs)
    .values({
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      request_type: mapBhudhiTriggerToRequestType(params.triggerType as BhudhiTriggerType, {
        sourceEngine: params.sourceEngine,
      }),
      trigger_type: mapBhudhiTriggerToDbEnum(params.triggerType as BhudhiTriggerType),
      input_json: {
        promptName: params.promptName,
        status: params.status,
        provider,
        fallbackReason: params.fallbackReason,
        errorCode: params.errorCode,
        web_search_calls: (params as { webSearchCalls?: number }).webSearchCalls,
        intelligence_grounded: (params as { intelligenceGrounded?: boolean }).intelligenceGrounded,
        memory_ids_used: params.memoryIdsUsed ?? [],
        memory_write_ids: params.memoryWriteIds ?? [],
      },
      prompt_version: params.promptVersion,
      model_used: modelIdForProvider(provider),
      provider,
      token_count_in: params.inputTokens,
      token_count_out: params.outputTokens,
      latency_ms: params.latencyMs,
      output_json: { estimated_cost_usd: cost },
      validation_status: params.status,
      validation_notes: params.fallbackReason ?? params.errorCode,
    })
    .returning({ id: bhudhiLogs.id });

  if (!row) throw new Error("BhudhiLog insert returned no id");
  return row.id;
}

export async function updateBhudhiLog(params: {
  logId: string;
  userId?: string;
  triggerType?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  status: "success" | "fallback" | "error" | "rejected";
  fallbackReason?: string;
  errorCode?: string;
  outputJson?: Record<string, unknown>;
}): Promise<void> {
  if (!params.logId) return;

  const cost = estimatedCostUsd(params.inputTokens ?? 0, params.outputTokens ?? 0);
  const costCents = BudgetController.estimateCostCents(params.inputTokens ?? 0, params.outputTokens ?? 0);
  const patch: Record<string, unknown> = {
    validation_status: params.status,
    validation_notes: params.fallbackReason ?? params.errorCode,
    fallback_used: params.status === "fallback" || params.status === "rejected",
  };
  if (params.inputTokens !== undefined) patch["token_count_in"] = params.inputTokens;
  if (params.outputTokens !== undefined) patch["token_count_out"] = params.outputTokens;
  if (params.latencyMs !== undefined) patch["latency_ms"] = params.latencyMs;
  patch["output_json"] = params.outputJson ?? { estimated_cost_usd: cost, estimated_cost_cents: costCents };
  if (params.outputJson?.web_search_calls != null) {
    patch["web_search_calls"] = Number(params.outputJson.web_search_calls);
  }
  if (params.outputJson?.intelligence_grounded != null) {
    patch["intelligence_grounded"] = Boolean(params.outputJson.intelligence_grounded);
  }
  if (params.outputJson?.web_search_used != null) {
    patch["web_search_used"] = Boolean(params.outputJson.web_search_used);
  }
  if (Array.isArray(params.outputJson?.search_queries)) {
    patch["search_queries"] = params.outputJson.search_queries;
  }

  await db
    .update(bhudhiLogs)
    .set(patch as typeof bhudhiLogs.$inferInsert)
    .where(eq(bhudhiLogs.id, params.logId));

  if (params.inputTokens !== undefined && params.outputTokens !== undefined) {
    await BudgetController.recordCallCost({
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      triggerType: params.triggerType,
      userId: params.userId,
    }).catch(() => undefined);
  }
}
