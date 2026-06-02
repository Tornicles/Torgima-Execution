import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { scanPatterns, scanAll } from "../engines/pattern/PatternLearningEngine.js";
import { getBoss } from "../lib/queue.js";
import { logger } from "../lib/logger.js";
import { WorkerQueues } from "../types/eventContracts.js";

export const PATTERN_SCAN_QUEUE = WorkerQueues.PATTERN_SCAN;
export const PATTERN_DAILY_QUEUE = WorkerQueues.PATTERN_DAILY_CRON;

let scheduleStarted = false;

async function runScan(data: {
  userId?: string;
  blueprintId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  if (data.userId && data.blueprintId) {
    await scanPatterns({
      userId: data.userId,
      blueprintId: data.blueprintId,
      windowDays: (data.payload?.window_days as number | undefined) ?? 14,
    });
    return;
  }
  await scanAll();
}

workerRegistry.register({
  name: "PatternScanWorker",
  queue: PATTERN_SCAN_QUEUE,
  options: { localConcurrency: 2, pollingIntervalSeconds: 5 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "PatternScanWorker", async (data) => {
        if (!data.blueprintId || !data.userId) {
          return { success: false, retryable: false, reason: "Missing blueprint or user" };
        }
        await runScan(data);
        return { success: true };
      });
    }
  },
});

workerRegistry.register({
  name: "PatternDailyWorker",
  queue: PATTERN_DAILY_QUEUE,
  options: { localConcurrency: 1, pollingIntervalSeconds: 60 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "PatternDailyWorker", async () => {
        await scanAll();
        return { success: true };
      });
    }
  },
});

export async function startPatternSchedule(): Promise<void> {
  if (scheduleStarted) return;
  scheduleStarted = true;

  try {
    const boss = await getBoss();
    await boss.createQueue(PATTERN_DAILY_QUEUE);
    await boss.schedule(PATTERN_DAILY_QUEUE, "0 3 * * *", {}, {
      singletonKey: "pattern-daily",
    });
    logger.info("[PatternWorker] Daily scan scheduled 0 3 * * * UTC (singleton pattern-daily)");
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[PatternWorker] pg-boss schedule unavailable",
    );
  }
}
