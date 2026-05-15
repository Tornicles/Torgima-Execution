import { db, eisCallLogs, eisRateLimits } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import type { EISIntelligence } from "./intelligence/validation-intelligence-types.js";

const WINDOW_MS = 6 * 60 * 60 * 1000;
const DAILY_BUDGET_USD = Number(process.env.EIS_DAILY_BUDGET_USD ?? "2.5");

export type EISAccessResult =
  | { mode: "live" }
  | { mode: "cached"; payload: EISIntelligence; lowConfidence: boolean }
  | { mode: "budget_exceeded"; payload: EISIntelligence; lowConfidence: true };

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /eis_rate_limits|eis_call_logs|does not exist|relation/.test(msg);
}

export async function checkEISAccess(params: {
  userId: string;
  blueprintId: string;
  industry: string;
  niche: string;
  goalChangedSignificantly?: boolean;
}): Promise<EISAccessResult> {
  try {
    const [row] = await db
      .select()
      .from(eisRateLimits)
      .where(
        and(
          eq(eisRateLimits.user_id, params.userId),
          eq(eisRateLimits.industry, params.industry),
          eq(eisRateLimits.niche, params.niche),
        ),
      )
      .limit(1);

    if (row?.cached_payload && !params.goalChangedSignificantly) {
      const age = Date.now() - row.last_call_at.getTime();
      if (age < WINDOW_MS) {
        return {
          mode: "cached",
          payload: row.cached_payload as EISIntelligence,
          lowConfidence: false,
        };
      }
    }

    const dayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const spendRows = await db
      .select({ cost: eisCallLogs.estimated_cost_usd })
      .from(eisCallLogs)
      .where(
        and(eq(eisCallLogs.user_id, params.userId), gte(eisCallLogs.created_at, dayStart)),
      );

    const spent = spendRows.reduce((s, r) => s + (r.cost ?? 0), 0);
    if (spent >= DAILY_BUDGET_USD && row?.cached_payload) {
      return {
        mode: "budget_exceeded",
        payload: row.cached_payload as EISIntelligence,
        lowConfidence: true,
      };
    }
  } catch (err) {
    if (isMissingTableError(err)) {
      logger.warn("[EISRateLimit] Tables missing — using live mode (run schema patches)");
    } else {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "[EISRateLimit] checkEISAccess failed — using live mode",
      );
    }
  }

  return { mode: "live" };
}

export async function recordEISCall(params: {
  userId: string;
  blueprintId: string;
  validationId?: string;
  industry: string;
  niche: string;
  payload: EISIntelligence;
  tokensUsed?: number;
  estimatedCostUsd?: number;
  modelUsed?: string;
  cacheHit?: boolean;
  lowConfidence?: boolean;
}): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: eisRateLimits.id })
      .from(eisRateLimits)
      .where(
        and(
          eq(eisRateLimits.user_id, params.userId),
          eq(eisRateLimits.industry, params.industry),
          eq(eisRateLimits.niche, params.niche),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(eisRateLimits)
        .set({
          last_call_at: new Date(),
          cached_payload: params.payload as unknown as Record<string, unknown>,
        })
        .where(eq(eisRateLimits.id, existing.id));
    } else {
      await db.insert(eisRateLimits).values({
        user_id: params.userId,
        industry: params.industry,
        niche: params.niche,
        cached_payload: params.payload as unknown as Record<string, unknown>,
      });
    }

    await db.insert(eisCallLogs).values({
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      validation_id: params.validationId ?? null,
      industry: params.industry,
      niche: params.niche,
      tokens_used: params.tokensUsed ?? null,
      estimated_cost_usd: params.estimatedCostUsd ?? 0.02,
      model_used: params.modelUsed ?? process.env.BHUDHI_MODEL ?? "claude",
      cache_hit: params.cacheHit ?? false,
      low_confidence: params.lowConfidence ?? false,
    });
  } catch (err) {
    if (!isMissingTableError(err)) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "[EISRateLimit] recordEISCall failed — continuing without cost log",
      );
    }
  }
}
