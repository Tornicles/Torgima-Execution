import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { runIntegrityChecks, processFindings } from "../services/SystemHealthService.js";
import { logger } from "../lib/logger.js";

// HealthWorker — runs full integrity sweep every time a system_health_event
// arrives, plus on the 30-minute interval started by startScheduledHealthChecks().
//
// Spec: Prompt 6 §STEP 5, DOC_17 §11, §17. GAP G3: sweep every 5 minutes.

export const HEALTH_QUEUE = "system_health_event";
export const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;

workerRegistry.register({
  name: "HealthWorker",
  queue: HEALTH_QUEUE,
  options: { localConcurrency: 1, pollingIntervalSeconds: 30 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "HealthWorker", async () => {
        logger.info("[HealthWorker] Running integrity checks...");

        const findings = await runIntegrityChecks();
        await processFindings(findings);

        logger.info(
          {
            total: findings.length,
            critical: findings.filter((f) =>
              ["CRITICAL", "FATAL"].includes(f.severity),
            ).length,
            errors: findings.filter((f) => f.severity === "ERROR").length,
            warnings: findings.filter((f) => f.severity === "WARN").length,
          },
          "[HealthWorker] Integrity checks complete",
        );

        return { success: true };
      });
    }
  },
});

let scheduledTimer: ReturnType<typeof setInterval> | null = null;

// Periodic integrity sweep, independent of incoming events (GAP G3: every 5 minutes).
export function startScheduledHealthChecks(): void {
  if (scheduledTimer) return;

  const runSweep = async () => {
    const findings = await runIntegrityChecks();
    await processFindings(findings);
  };

  void runSweep().catch((error) => {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[HealthWorker] Initial scheduled check failed",
    );
  });

  scheduledTimer = setInterval(async () => {
    try {
      await runSweep();
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[HealthWorker] Scheduled check failed",
      );
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  logger.info(
    { intervalMs: HEALTH_CHECK_INTERVAL_MS },
    "[HealthWorker] Scheduled health checks started (every 5 minutes)",
  );
}

export function stopScheduledHealthChecks(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
