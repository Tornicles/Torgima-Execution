import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { runIntegrityChecks, processFindings } from "../services/SystemHealthService.js";
import { logger } from "../lib/logger.js";

// HealthWorker — runs full integrity sweep every time a system_health_event
// arrives, plus on the 30-minute interval started by startScheduledHealthChecks().
//
// Spec: Prompt 6 §STEP 5, DOC_17 §11, §17.

export const HEALTH_QUEUE = "system_health_event";

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

// Periodic integrity sweep, independent of incoming events. Runs every 30 minutes.
export function startScheduledHealthChecks(): void {
  if (scheduledTimer) return;

  scheduledTimer = setInterval(async () => {
    try {
      const findings = await runIntegrityChecks();
      await processFindings(findings);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[HealthWorker] Scheduled check failed",
      );
    }
  }, 30 * 60 * 1000);

  logger.info("[HealthWorker] Scheduled health checks started (every 30 minutes)");
}

export function stopScheduledHealthChecks(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
