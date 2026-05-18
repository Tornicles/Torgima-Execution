import { db, bhudhiMemory } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export const COMPRESSION_THRESHOLD = 200;

export async function runCompressionCycle(userId: string): Promise<{ compressed: number }> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bhudhiMemory)
    .where(eq(bhudhiMemory.user_id, userId));

  if ((count ?? 0) <= COMPRESSION_THRESHOLD) {
    return { compressed: 0 };
  }

  let compressed = 0;
  for (const memoryType of ["EXECUTION_PATTERN", "FRICTION_PATTERN"] as const) {
    const rows = await db
      .select()
      .from(bhudhiMemory)
      .where(
        and(
          eq(bhudhiMemory.user_id, userId),
          eq(bhudhiMemory.memory_type, memoryType),
          eq(bhudhiMemory.is_compressed, false),
        ),
      )
      .limit(50);

    if (rows.length < 5) continue;

    await db
      .update(bhudhiMemory)
      .set({ active: false, is_compressed: true })
      .where(
        and(
          eq(bhudhiMemory.user_id, userId),
          eq(bhudhiMemory.memory_type, memoryType),
          eq(bhudhiMemory.is_compressed, false),
        ),
      );

    await db.insert(bhudhiMemory).values({
      user_id: userId,
      memory_type: memoryType,
      content_json: {
        text: `Compressed summary of ${rows.length} ${memoryType} memories`,
        compressed: true,
      },
      confidence: 0.7,
      is_compressed: true,
      active: true,
    });

    compressed += rows.length;
  }

  logger.info({ userId, compressed }, "[CompressionWorker] Cycle complete");
  return { compressed };
}
