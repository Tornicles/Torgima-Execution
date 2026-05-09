import type { Job } from "pg-boss";
import { logger } from "../lib/logger.js";
import { getBoss } from "../lib/queue.js";

/**
 * WorkerRegistry — Registers all pg-boss workers on startup.
 * Each worker subscribes to its named job queue.
 *
 * TODO (Prompt 5): Implement full worker registration with SystemOrchestrationEngine
 */
export async function registerWorkers(): Promise<void> {
  const boss = await getBoss();

  await boss.work("signal-recalculate", async (jobs: Job<unknown>[]) => {
    jobs.forEach((job) => logger.info({ jobId: job.id }, "SignalWorker — TODO"));
  });

  await boss.work("condition-evaluate", async (jobs: Job<unknown>[]) => {
    jobs.forEach((job) => logger.info({ jobId: job.id }, "ConditionWorker — TODO"));
  });

  await boss.work("task-generate", async (jobs: Job<unknown>[]) => {
    jobs.forEach((job) => logger.info({ jobId: job.id }, "TaskGenerationWorker — TODO"));
  });

  await boss.work("feedback-process", async (jobs: Job<unknown>[]) => {
    jobs.forEach((job) => logger.info({ jobId: job.id }, "FeedbackWorker — TODO"));
  });

  await boss.work("inactivity-check", async (jobs: Job<unknown>[]) => {
    jobs.forEach((job) => logger.info({ jobId: job.id }, "InactivityWorker — TODO"));
  });

  await boss.work("notification-send", async (jobs: Job<unknown>[]) => {
    jobs.forEach((job) => logger.info({ jobId: job.id }, "NotificationWorker — TODO"));
  });

  logger.info("WorkerRegistry — all workers registered");
}
