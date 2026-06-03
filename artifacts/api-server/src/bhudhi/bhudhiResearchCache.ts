import { createHash } from "node:crypto";
import { db, bhudhiResearchCache } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";

function hashQuery(triggerType: string, queryText: string): string {
  return createHash("sha256").update(`${triggerType}:${queryText}`).digest("hex");
}

export async function lookupResearchCache(params: {
  triggerType: string;
  queryText: string;
}): Promise<{ resultJson: unknown; tokensUsed?: number } | null> {
  const queryHash = hashQuery(params.triggerType, params.queryText);
  try {
    const [row] = await db
      .select()
      .from(bhudhiResearchCache)
      .where(
        and(
          eq(bhudhiResearchCache.query_hash, queryHash),
          gt(bhudhiResearchCache.expires_at, new Date()),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      resultJson: row.result_json,
      tokensUsed: row.tokens_used ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function storeResearchCache(params: {
  triggerType: string;
  queryText: string;
  resultJson: unknown;
  tokensUsed?: number;
  /** Default 24h; competitor deep analysis uses 48h per spec. */
  ttlHours?: number;
}): Promise<void> {
  const queryHash = hashQuery(params.triggerType, params.queryText);
  const hours = params.ttlHours ?? 24;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  try {
    await db
      .insert(bhudhiResearchCache)
      .values({
        query_hash: queryHash,
        query_text: params.queryText.slice(0, 4000),
        research_type: params.triggerType,
        result_json: params.resultJson as Record<string, unknown>,
        confidence: "MEDIUM",
        tokens_used: params.tokensUsed ?? null,
        expires_at: expiresAt,
      })
      .onConflictDoUpdate({
        target: bhudhiResearchCache.query_hash,
        set: {
          result_json: params.resultJson as Record<string, unknown>,
          tokens_used: params.tokensUsed ?? null,
          expires_at: expiresAt,
        },
      });
  } catch {
    /* fail open — cache is optional */
  }
}
