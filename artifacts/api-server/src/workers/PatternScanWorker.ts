import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { scanPatterns } from "../engines/pattern/PatternLearningEngine.js";

export const PATTERN_SCAN_QUEUE = "pattern_scan_requested";

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
        await scanPatterns({
          userId: data.userId,
          blueprintId: data.blueprintId,
          windowDays: (data.payload?.window_days as number | undefined) ?? 7,
        });
        return { success: true };
      });
    }
  },
});
