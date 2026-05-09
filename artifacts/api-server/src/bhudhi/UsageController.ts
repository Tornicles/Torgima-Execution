import { db, bhudhiLogs, users } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { mapBhudhiTriggerToDbEnum } from "./bhudhiLogMapping.js";

const DAILY_CAPS: Record<string, number> = {
  starter:  20,
  growth:   50,
  ultimate: 200,
};

const TIMEOUT_MS = 10000;
const TASK_TIMEOUT_MS = 5000;

function estimatedCostUsd(inputTokens: number, outputTokens: number): number {
  return inputTokens * 0.000003 + outputTokens * 0.000015;
}

export async function checkUsageAllowed(params: {
  userId:      string;
  triggerType: string;
}): Promise<{ allowed: boolean; reason?: string }> {

  const [user] = await db
    .select({ tier: users.tier })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  const tier      = user?.tier ?? "starter";
  const dailyCap  = DAILY_CAPS[tier] ?? DAILY_CAPS.starter;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bhudhiLogs)
    .where(and(eq(bhudhiLogs.user_id, params.userId), gte(bhudhiLogs.created_at, todayStart)));

  const todayCount = count ?? 0;

  if (todayCount >= dailyCap) {
    logger.warn({ userId: params.userId, tier, cap: dailyCap, used: todayCount }, "[UsageController] Daily cap reached");
    return { allowed: false, reason: `Daily AI call limit reached (${dailyCap} calls for ${tier} tier)` };
  }

  void params.triggerType;
  return { allowed: true };
}

export function getTimeout(triggerType: string): number {
  if (triggerType === "TASK_DRAFTING") return TASK_TIMEOUT_MS;
  return TIMEOUT_MS;
}

export async function logUsage(params: {
  userId:          string;
  blueprintId?:    string;
  triggerType:     BhudhiTriggerType | string;
  promptName:      string;
  promptVersion:   string;
  inputTokens:     number;
  outputTokens:    number;
  latencyMs:       number;
  status:          "success" | "fallback" | "error" | "rejected" | "pending";
  fallbackReason?: string;
  errorCode?:      string;
}): Promise<string> {

  const cost = estimatedCostUsd(params.inputTokens, params.outputTokens);

  const [row] = await db
    .insert(bhudhiLogs)
    .values({
      user_id:        params.userId,
      blueprint_id:   params.blueprintId,
      request_type:   "other",
      trigger_type:   mapBhudhiTriggerToDbEnum(params.triggerType as BhudhiTriggerType),
      input_json:     {
        promptName:   params.promptName,
        status:       params.status,
        fallbackReason: params.fallbackReason,
        errorCode:    params.errorCode,
      },
      prompt_version: params.promptVersion,
      model_used:     process.env.BHUDHI_MODEL ?? "claude-sonnet-4-20250514",
      token_count_in: params.inputTokens,
      token_count_out: params.outputTokens,
      latency_ms:     params.latencyMs,
      output_json:    { estimated_cost_usd: cost },
      validation_status: params.status,
      validation_notes: params.fallbackReason ?? params.errorCode,
    })
    .returning({ id: bhudhiLogs.id });

  if (!row) throw new Error("BhudhiLog insert returned no id");
  return row.id;
}

export async function updateBhudhiLog(params: {
  logId:           string;
  inputTokens?:    number;
  outputTokens?:   number;
  latencyMs?:      number;
  status:          "success" | "fallback" | "error" | "rejected";
  fallbackReason?: string;
  errorCode?:      string;
  outputJson?:     Record<string, unknown>;
}): Promise<void> {
  const cost = estimatedCostUsd(params.inputTokens ?? 0, params.outputTokens ?? 0);
  const patch: Record<string, unknown> = {
    validation_status: params.status,
    validation_notes: params.fallbackReason ?? params.errorCode,
  };
  if (params.inputTokens !== undefined) patch["token_count_in"] = params.inputTokens;
  if (params.outputTokens !== undefined) patch["token_count_out"] = params.outputTokens;
  if (params.latencyMs !== undefined) patch["latency_ms"] = params.latencyMs;
  patch["output_json"] = params.outputJson ?? { estimated_cost_usd: cost };

  await db.update(bhudhiLogs).set(patch as typeof bhudhiLogs.$inferInsert).where(eq(bhudhiLogs.id, params.logId));
}
