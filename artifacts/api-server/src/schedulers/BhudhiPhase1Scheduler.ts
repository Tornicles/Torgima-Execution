import { db, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { runOvernightCycle } from "../workers/OvernightWorker.js";
import { runWorldStateUpdate } from "../workers/WorldStateWorker.js";
import { runCompressionCycle } from "../workers/CompressionWorker.js";
import { BhudhiMemoryService } from "../bhudhi/BhudhiMemoryService.js";
import { getBoss } from "../lib/queue.js";
import { MEMORY_EXPIRY_QUEUE } from "../workers/MemoryExpiryWorker.js";

const timers: ReturnType<typeof setInterval>[] = [];

function schedule(ms: number, name: string, fn: () => Promise<void>): void {
  const t = setInterval(async () => {
    try {
      await fn();
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err), job: name },
        "[BhudhiPhase1Scheduler] Job failed",
      );
    }
  }, ms);
  timers.push(t);
  logger.info({ job: name, intervalMs: ms }, "[BhudhiPhase1Scheduler] Registered");
}

async function forEachActiveUser(fn: (userId: string) => Promise<void>): Promise<void> {
  const active = await db
    .select({ user_id: blueprints.user_id })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));
  const seen = new Set<string>();
  for (const row of active) {
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    await fn(row.user_id);
  }
}

/** Prompt 1 schedules: overnight ~02:00 UTC, world state every 6h, compression weekly. */
export function startBhudhiPhase1Schedulers(): void {
  schedule(24 * 60 * 60 * 1000, "overnight_intelligence", async () => {
    await forEachActiveUser(userId => runOvernightCycle(userId).then(() => undefined));
  });

  schedule(6 * 60 * 60 * 1000, "world_state_update", async () => {
    await forEachActiveUser(userId => runWorldStateUpdate(userId).then(() => undefined));
  });

  schedule(7 * 24 * 60 * 60 * 1000, "memory_compression", async () => {
    await forEachActiveUser(userId => runCompressionCycle(userId).then(() => undefined));
  });

  schedule(24 * 60 * 60 * 1000, "memory_expiry_scan", async () => {
    const count = await BhudhiMemoryService.expireOldMemory();
    logger.info({ count }, "[BhudhiPhase1Scheduler] memory_expiry_scan complete");
    try {
      const boss = await getBoss();
      await boss.createQueue(MEMORY_EXPIRY_QUEUE);
      await boss.send(MEMORY_EXPIRY_QUEUE, { trigger: "scheduled" });
    } catch {
      /* queue optional */
    }
  });
}

export function stopBhudhiPhase1Schedulers(): void {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
}
