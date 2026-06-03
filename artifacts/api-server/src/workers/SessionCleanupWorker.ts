/**
 * DOC 30 §8 — daily session and magic-link cleanup (02:00 UTC).
 */

import { db, sessions, magicLinkTokens } from "@workspace/db";
import { and, gt, like, lt, not } from "drizzle-orm";
import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { getBoss } from "../lib/queue.js";
import { logger } from "../lib/logger.js";

export const SESSION_CLEANUP_QUEUE = "session_cleanup";
const MAGIC_PREFIX = "magic:";
const IDLE_MS = 7 * 24 * 60 * 60 * 1000;

let scheduleStarted = false;

export async function runSessionCleanup(): Promise<{
  expiredSessions: number;
  idleSessions: number;
  expiredMagicLinks: number;
}> {
  const now = new Date();
  const idleCutoff = new Date(Date.now() - IDLE_MS);

  const expired = await db
    .delete(sessions)
    .where(
      and(
        lt(sessions.expires_at, now),
        not(like(sessions.token_hash, `${MAGIC_PREFIX}%`)),
      ),
    )
    .returning({ id: sessions.id });

  const idle = await db
    .delete(sessions)
    .where(
      and(
        lt(sessions.last_used_at, idleCutoff),
        gt(sessions.expires_at, now),
        not(like(sessions.token_hash, `${MAGIC_PREFIX}%`)),
      ),
    )
    .returning({ id: sessions.id });

  const magicExpired = await db
    .delete(magicLinkTokens)
    .where(lt(magicLinkTokens.expires_at, now))
    .returning({ id: magicLinkTokens.id });

  const legacyMagic = await db
    .delete(sessions)
    .where(
      and(like(sessions.token_hash, `${MAGIC_PREFIX}%`), lt(sessions.expires_at, now)),
    )
    .returning({ id: sessions.id });

  const result = {
    expiredSessions: expired.length + legacyMagic.length,
    idleSessions: idle.length,
    expiredMagicLinks: magicExpired.length,
  };

  logger.info(result, "[SessionCleanupWorker] Cleanup complete");
  return result;
}

workerRegistry.register({
  name: "SessionCleanupWorker",
  queue: SESSION_CLEANUP_QUEUE,
  options: { localConcurrency: 1, pollingIntervalSeconds: 60 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "SessionCleanupWorker", async () => {
        await runSessionCleanup();
        return { success: true };
      });
    }
  },
});

export async function startSessionCleanupSchedule(): Promise<void> {
  if (scheduleStarted) return;
  scheduleStarted = true;

  try {
    const boss = await getBoss();
    await boss.createQueue(SESSION_CLEANUP_QUEUE);
    await boss.schedule(SESSION_CLEANUP_QUEUE, "0 2 * * *", {}, {
      singletonKey: "session-cleanup",
    });
    logger.info(
      "[SessionCleanupWorker] pg-boss schedule 0 2 * * * (singletonKey: session-cleanup)",
    );
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[SessionCleanupWorker] pg-boss schedule unavailable",
    );
  }
}
