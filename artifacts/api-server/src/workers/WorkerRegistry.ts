import type { Job, WorkOptions } from "pg-boss";
import { isCloudflareRuntime } from "../lib/cloudflare-runtime.js";
import { getBoss } from "../lib/queue.js";
import { logger } from "../lib/logger.js";
import { WorkerQueues } from "../types/eventContracts.js";

export interface WorkerDefinition {
  name: string;
  queue: string;
  options?: WorkOptions;
  handler: (jobs: Job<unknown>[]) => Promise<void>;
}

/**
 * Phase 6 / DOC 28 — canonical worker catalog (registration via side-effect imports in start.ts).
 * EventDispatcher runs on continuous poll; Inactivity/Pattern/StateIntegrity use pg-boss cron.
 */
export const WORKER_CATALOG = [
  { name: "SignalWorker", queue: WorkerQueues.SIGNAL_RECALCULATION, phase: "DOC_04-09" },
  { name: "ConditionWorker", queue: WorkerQueues.CONDITION_EVALUATION, phase: "DOC_04-09" },
  { name: "ControlWorker", queue: WorkerQueues.ENFORCEMENT_PACKAGE, phase: "DOC_04-09" },
  { name: "TaskGenerationWorker", queue: WorkerQueues.TASK_GENERATION, phase: "DOC_04-09" },
  { name: "TaskGuaranteeWorker", queue: WorkerQueues.TASK_GUARANTEE, phase: "DOC_04-09" },
  { name: "FeedbackWorker", queue: WorkerQueues.FEEDBACK_PROCESSING, phase: "Phase 1" },
  { name: "InactivityWorker", queue: WorkerQueues.INACTIVITY_CRON, phase: "Phase 1", schedule: "*/30 * * * *" },
  { name: "EventDispatcherWorker", queue: "event_dispatch_poll", phase: "Phase 2", note: "continuous 5s poll" },
  { name: "StateIntegrityWorker", queue: WorkerQueues.SYSTEM_HEALTH, phase: "Phase 2", schedule: "*/10 * * * *" },
  { name: "IdentityWorker", queue: WorkerQueues.IDENTITY_EVALUATION, phase: "Phase 3" },
  { name: "RewardWorker", queue: WorkerQueues.REWARD_EVALUATION, phase: "Phase 3" },
  { name: "OutcomeValidationWorker", queue: WorkerQueues.OUTCOME_VALIDATION, phase: "Phase 3" },
  { name: "PatternScanWorker", queue: WorkerQueues.PATTERN_SCAN, phase: "Phase 4" },
  { name: "PatternDailyWorker", queue: WorkerQueues.PATTERN_DAILY_CRON, phase: "Phase 4", schedule: "0 3 * * *" },
  { name: "FailureWorker", queue: WorkerQueues.FAILURE_CLASSIFICATION, phase: "Phase 4" },
  { name: "ProjectionWorker", queue: WorkerQueues.PROJECTION_REFRESH, phase: "DOC_04-09" },
] as const;

const _registry: WorkerDefinition[] = [];

export const workerRegistry = {
  register(def: WorkerDefinition): void {
    _registry.push(def);
  },

  getRegistered(): readonly WorkerDefinition[] {
    return _registry;
  },

  async startAll(): Promise<void> {
    if (isCloudflareRuntime()) {
      logger.info(
        { count: _registry.length },
        "[WorkerRegistry] Cloudflare runtime — in-process pg-boss workers skipped (queue consumer handles jobs)",
      );
      return;
    }

    const boss = await getBoss();

    const uniqueQueues = [...new Set(_registry.map((d) => d.queue))];
    for (const queueName of uniqueQueues) {
      await boss.createQueue(queueName);
      logger.debug({ queue: queueName }, "[WorkerRegistry] Queue ensured");
    }

    for (const def of _registry) {
      await boss.work(def.queue, def.options ?? {}, def.handler);
      logger.info({ queue: def.queue }, `[WorkerRegistry] Registered: ${def.name}`);
    }

    logger.info(
      { count: _registry.length, catalog: WORKER_CATALOG.length },
      "[WorkerRegistry] Workers started",
    );
  },
};
