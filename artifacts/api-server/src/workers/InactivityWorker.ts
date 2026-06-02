import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { scanAll } from "../engines/execution-loop/InactivityDetectionEngine.js";
import { getBoss } from "../lib/queue.js";
import { logger } from "../lib/logger.js";
import { WorkerQueues } from "../types/eventContracts.js";

/** Phase 1 — pg-boss cron queue (30-minute singleton schedule). */
export const INACTIVITY_QUEUE = WorkerQueues.INACTIVITY_CRON;

const THIRTY_MIN_MS = 30 * 60 * 1000;
let scheduleStarted = false;

async function runScanJob(): Promise<void> {
  const result = await scanAll();
  logger.info(result, "[InactivityWorker] Scan complete");
}

workerRegistry.register({
  name: "InactivityWorker",
  queue: INACTIVITY_QUEUE,
  options: { localConcurrency: 1, pollingIntervalSeconds: 30 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "InactivityWorker", async () => {
        await runScanJob();
        return { success: true };
      });
    }
  },
});

/** Legacy outbox events still enqueue inactivity_scan_requested. */
workerRegistry.register({
  name: "InactivityScanRequestedWorker",
  queue: WorkerQueues.INACTIVITY_SCAN,
  options: { localConcurrency: 1, pollingIntervalSeconds: 30 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "InactivityScanRequestedWorker", async () => {
        await runScanJob();
        return { success: true };
      });
    }
  },
});

export async function startInactivitySchedule(): Promise<void> {
  if (scheduleStarted) return;
  scheduleStarted = true;

  try {
    const boss = await getBoss();
    await boss.createQueue(INACTIVITY_QUEUE);
    await boss.schedule(INACTIVITY_QUEUE, "*/30 * * * *", {}, {
      singletonKey: "inactivity-scan",
    });
    logger.info(
      "[InactivityWorker] pg-boss schedule */30 * * * * (singletonKey: inactivity-scan)",
    );
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[InactivityWorker] pg-boss schedule unavailable",
    );
  }

  setInterval(() => {
    void getBoss()
      .then((boss) =>
        boss.send(INACTIVITY_QUEUE, { trigger: "interval_fallback" }, {
          singletonKey: `inactivity-scan-fallback:${Math.floor(Date.now() / THIRTY_MIN_MS)}`,
        }),
      )
      .catch(() => null);
  }, THIRTY_MIN_MS);

  void runScanJob().catch((err) => {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "[InactivityWorker] Initial scan failed",
    );
  });
}
