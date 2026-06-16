import { db, bhudhiLogs, bhudhiUsageBudget, featureFlags, systemHealthLogs, users } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { logger } from "../logger.js";

const TIER_DAILY_CAPS: Record<string, number> = {
  starter: 20,
  growth: 50,
  ultimate: 100,
};

const GLOBAL_EMERGENCY_CAP = parseInt(process.env.BHUDHI_GLOBAL_DAILY_CAP ?? "50000", 10);
const WARN_COST_CENTS = 500;
const ERROR_COST_CENTS = 2000;
const FORCE_FALLBACK_FLAG = "bhudhi_force_fallbacks";
const MONTHLY_COST_FLAG = "bhudhi_monthly_cost_cents";
const MONTHLY_BUDGET_CAP_FLAG = "bhudhi_monthly_budget_cap_cents";

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function estimateCostCents(inputTokens: number, outputTokens: number): number {
  return inputTokens * 0.0003 + outputTokens * 0.0015;
}

async function countUserCallsToday(userId: string): Promise<number> {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bhudhiLogs)
      .where(and(eq(bhudhiLogs.user_id, userId), gte(bhudhiLogs.created_at, todayStart())));
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function resolveTier(userId: string): Promise<string> {
  try {
    const [user] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, userId)).limit(1);
    return user?.tier ?? "starter";
  } catch {
    return "starter";
  }
}

async function readFlag(name: string): Promise<{ enabled: boolean; description: string | null }> {
  try {
    const [row] = await db
      .select({ enabled: featureFlags.enabled, description: featureFlags.description })
      .from(featureFlags)
      .where(eq(featureFlags.feature_name, name))
      .limit(1);
    return { enabled: row?.enabled ?? false, description: row?.description ?? null };
  } catch {
    return { enabled: false, description: null };
  }
}

async function upsertFlag(name: string, description: string, enabled: boolean): Promise<void> {
  const [existing] = await db
    .select({ id: featureFlags.id })
    .from(featureFlags)
    .where(eq(featureFlags.feature_name, name))
    .limit(1);

  if (existing) {
    await db
      .update(featureFlags)
      .set({ description, enabled, updated_at: new Date() })
      .where(eq(featureFlags.id, existing.id));
    return;
  }

  await db.insert(featureFlags).values({
    feature_name: name,
    description,
    enabled,
  });
}

async function getMonthlyCostCents(): Promise<number> {
  const flag = await readFlag(MONTHLY_COST_FLAG);
  if (!flag.description) return 0;
  try {
    const parsed = JSON.parse(flag.description) as { month?: string; cents?: number };
    if (parsed.month !== currentMonthKey()) return 0;
    return Number(parsed.cents ?? 0);
  } catch {
    return Number(flag.description) || 0;
  }
}

async function incrementMonthlyCostCents(deltaCents: number): Promise<void> {
  const month = currentMonthKey();
  const current = await getMonthlyCostCents();
  await upsertFlag(
    MONTHLY_COST_FLAG,
    JSON.stringify({ month, cents: Math.round(current + deltaCents) }),
    false,
  );
}

async function emitHealthLog(severity: "WARN" | "ERROR", message: string, details: Record<string, unknown>): Promise<void> {
  try {
    await db.insert(systemHealthLogs).values({
      area: "bhudhi",
      severity,
      check_type: "BHUDHI_USAGE_BUDGET",
      message,
      status: severity === "ERROR" ? "degraded" : "warning",
      details_json: details,
      issues_detected: [message],
    });
  } catch (err) {
    logger.warn({ err }, "[BudgetController] Failed to write SystemHealthLog");
  }
}

export async function isGlobalFallbackMode(): Promise<boolean> {
  const flag = await readFlag(FORCE_FALLBACK_FLAG);
  return flag.enabled;
}

export async function checkUsageAlerts(totalCostCentsToday: number): Promise<void> {
  if (totalCostCentsToday > ERROR_COST_CENTS) {
    await upsertFlag(FORCE_FALLBACK_FLAG, "Daily Bhudhi cost exceeded $20 — fallbacks only", true);
    await emitHealthLog("ERROR", "Bhudhi daily cost exceeded $20 — switching to fallbacks", {
      total_cost_cents_today: totalCostCentsToday,
      threshold_cents: ERROR_COST_CENTS,
    });
    return;
  }

  if (totalCostCentsToday > WARN_COST_CENTS) {
    await emitHealthLog("WARN", "Bhudhi daily cost exceeded $5", {
      total_cost_cents_today: totalCostCentsToday,
      threshold_cents: WARN_COST_CENTS,
    });
  }
}

export async function recordCallCost(params: {
  inputTokens: number;
  outputTokens: number;
  triggerType?: string;
  userId?: string;
}): Promise<number> {
  const costCents = estimateCostCents(params.inputTokens, params.outputTokens);
  await incrementMonthlyCostCents(costCents);

  const report = await getDailyUsageReport();
  await checkUsageAlerts(report.total_cost_cents_today);

  if (params.userId && params.triggerType) {
    const tier = await resolveTier(params.userId);
    const today = todayStart().toISOString().split("T")[0]!;
    const [existing] = await db
      .select()
      .from(bhudhiUsageBudget)
      .where(and(eq(bhudhiUsageBudget.user_id, params.userId), eq(bhudhiUsageBudget.date_utc, today)))
      .limit(1);

    const callsByTrigger =
      existing?.calls_by_trigger && typeof existing.calls_by_trigger === "object"
        ? { ...(existing.calls_by_trigger as Record<string, number>) }
        : {};
    callsByTrigger[params.triggerType] = (callsByTrigger[params.triggerType] ?? 0) + 1;

    if (existing) {
      await db
        .update(bhudhiUsageBudget)
        .set({
          total_calls: (existing.total_calls ?? 0) + 1,
          total_input_tokens: (existing.total_input_tokens ?? 0) + params.inputTokens,
          total_output_tokens: (existing.total_output_tokens ?? 0) + params.outputTokens,
          total_cost_cents: (existing.total_cost_cents ?? 0) + costCents,
          calls_by_trigger: callsByTrigger,
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
      });
    }
  }

  return costCents;
}

export async function getDailyUsageReport(): Promise<{
  total_calls_today: number;
  total_cost_cents_today: number;
  calls_by_trigger: Record<string, number>;
  calls_by_user_tier: Record<string, number>;
  monthly_cost_cents: number;
  monthly_budget_cap_cents: number | null;
  force_fallbacks: boolean;
}> {
  const today = todayStart();

  const [{ totalCalls, inSum, outSum }] = await db
    .select({
      totalCalls: sql<number>`count(*)::int`,
      inSum: sql<number>`coalesce(sum(${bhudhiLogs.token_count_in}), 0)::int`,
      outSum: sql<number>`coalesce(sum(${bhudhiLogs.token_count_out}), 0)::int`,
    })
    .from(bhudhiLogs)
    .where(gte(bhudhiLogs.created_at, today));

  const triggerRows = await db
    .select({
      trigger: bhudhiLogs.trigger_type,
      count: sql<number>`count(*)::int`,
    })
    .from(bhudhiLogs)
    .where(gte(bhudhiLogs.created_at, today))
    .groupBy(bhudhiLogs.trigger_type);

  const tierRows = await db
    .select({
      tier: users.tier,
      count: sql<number>`count(*)::int`,
    })
    .from(bhudhiLogs)
    .innerJoin(users, eq(users.id, bhudhiLogs.user_id))
    .where(gte(bhudhiLogs.created_at, today))
    .groupBy(users.tier);

  const calls_by_trigger: Record<string, number> = {};
  for (const row of triggerRows) {
    if (row.trigger) calls_by_trigger[String(row.trigger)] = row.count ?? 0;
  }

  const calls_by_user_tier: Record<string, number> = {};
  for (const row of tierRows) {
    calls_by_user_tier[String(row.tier ?? "starter")] = row.count ?? 0;
  }

  const total_cost_cents_today = Math.round(estimateCostCents(inSum ?? 0, outSum ?? 0) * 100) / 100;
  const monthlyBudgetFlag = await readFlag(MONTHLY_BUDGET_CAP_FLAG);

  return {
    total_calls_today: totalCalls ?? 0,
    total_cost_cents_today,
    calls_by_trigger,
    calls_by_user_tier,
    monthly_cost_cents: await getMonthlyCostCents(),
    monthly_budget_cap_cents: monthlyBudgetFlag.description ? Number(monthlyBudgetFlag.description) : null,
    force_fallbacks: await isGlobalFallbackMode(),
  };
}

/** DOC12/DOC14 budget gate — returns false when caps reached (caller should use fallback). */
export async function checkAndReserve(userId: string): Promise<boolean> {
  if (await isGlobalFallbackMode()) {
    logger.warn("[BudgetController] Global fallback mode active — Bhudhi API calls blocked");
    return false;
  }

  const tier = await resolveTier(userId);
  const cap = TIER_DAILY_CAPS[tier] ?? TIER_DAILY_CAPS.starter!;
  const used = await countUserCallsToday(userId);
  if (used >= cap) {
    logger.warn({ userId, tier, cap, used }, "[BudgetController] Daily Bhudhi call cap reached");
    return false;
  }

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bhudhiLogs)
      .where(gte(bhudhiLogs.created_at, todayStart()));
    if ((count ?? 0) >= GLOBAL_EMERGENCY_CAP) {
      logger.warn({ globalUsed: count, cap: GLOBAL_EMERGENCY_CAP }, "[BudgetController] Global emergency cap");
      return false;
    }
  } catch {
    // allow on telemetry failure
  }

  const report = await getDailyUsageReport();
  if (report.total_cost_cents_today > ERROR_COST_CENTS) {
    return false;
  }

  const monthlyCap = report.monthly_budget_cap_cents;
  if (monthlyCap != null && report.monthly_cost_cents > monthlyCap) {
    logger.warn(
      { monthlyCost: report.monthly_cost_cents, monthlyCap },
      "[BudgetController] Monthly Bhudhi budget cap exceeded",
    );
    return false;
  }

  return true;
}

export const BudgetController = {
  checkAndReserve,
  recordCallCost,
  getDailyUsageReport,
  checkUsageAlerts,
  isGlobalFallbackMode,
  estimateCostCents,
  tierCaps: TIER_DAILY_CAPS,
};
