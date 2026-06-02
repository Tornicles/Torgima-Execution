import { workerRegistry } from "./WorkerRegistry.js";
import { runStateIntegrityValidation } from "../engines/state/StateIntegrityValidator.js";
import { processFindings } from "../services/SystemHealthService.js";
import { recordStateIntegrityRun } from "../engines/state/SystemHealthMonitor.js";
import { logger } from "../lib/logger.js";

export const STATE_INTEGRITY_QUEUE = "state_integrity_scan";

const TEN_MIN_MS = 10 * 60 * 1000;
let integrityTimer: ReturnType<typeof setInterval> | null = null;

async function runIntegritySweep(): Promise<void> {
  const result = await runStateIntegrityValidation();
  await processFindings(result.findings);
  recordStateIntegrityRun();
  logger.info(
    { ok: result.ok, findings: result.findings.length },
    "[StateIntegrityWorker] Sweep complete",
  );
}

workerRegistry.register({
  name: "StateIntegrityWorker",
  queue: STATE_INTEGRITY_QUEUE,
  options: { localConcurrency: 1, pollingIntervalSeconds: 30 },
  handler: async (jobs) => {
    for (const _job of jobs) {
      await runIntegritySweep();
    }
  },
});

/** Phase 2 — pg-boss-style 10-minute singleton schedule (setInterval + singleton guard). */
export function startStateIntegritySchedule(): void {
  if (integrityTimer) return;

  void runIntegritySweep().catch((err) => {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "[StateIntegrityWorker] Initial sweep failed",
    );
  });

  integrityTimer = setInterval(() => {
    void runIntegritySweep().catch((err) => {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "[StateIntegrityWorker] Scheduled sweep failed",
      );
    });
  }, TEN_MIN_MS);

  logger.info("[StateIntegrityWorker] Scheduled every 10 minutes");
}

export function stopStateIntegritySchedule(): void {
  if (integrityTimer) {
    clearInterval(integrityTimer);
    integrityTimer = null;
  }
}
