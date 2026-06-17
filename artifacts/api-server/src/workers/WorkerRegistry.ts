import type { Job, WorkOptions } from "pg-boss";
import { isCloudflareRuntime } from "../lib/cloudflare-runtime.js";
import { getBoss } from "../lib/queue.js";
import { logger } from "../lib/logger.js";
import { EventTypes, WorkerQueues } from "../types/eventContracts.js";
import type { RetryPolicyName } from "./RetryPolicy.js";

export type LockScope = "BLUEPRINT" | "USER" | "NONE";

export interface Doc16WorkerDefinition {
  name: string;
  consumes: readonly string[];
  produces: readonly string[];
  lockScope: LockScope;
  retryPolicy: RetryPolicyName;
  timeoutMs: number;
  queue?: string;
}

/** DOC16 Task 1 — all 10 registered workers with event mappings. */
export const WORKER_REGISTRY: Record<string, Doc16WorkerDefinition> = {
  FeedbackWorker: {
    name: "FeedbackWorker",
    consumes: [EventTypes.FEEDBACK_SUBMITTED, EventTypes.FEEDBACK_SUBMITTED_PARTIAL],
    produces: [EventTypes.SIGNAL_RECALCULATION_REQUESTED],
    lockScope: "BLUEPRINT",
    retryPolicy: "STANDARD",
    timeoutMs: 30_000,
    queue: WorkerQueues.FEEDBACK_PROCESSING,
  },
  SignalWorker: {
    name: "SignalWorker",
    consumes: [EventTypes.SIGNAL_RECALCULATION_REQUESTED],
    produces: [EventTypes.SIGNAL_CALCULATED, EventTypes.CONDITION_EVALUATION_REQUESTED],
    lockScope: "BLUEPRINT",
    retryPolicy: "STANDARD",
    timeoutMs: 15_000,
    queue: WorkerQueues.SIGNAL_RECALCULATION,
  },
  ConditionWorker: {
    name: "ConditionWorker",
    consumes: [EventTypes.CONDITION_EVALUATION_REQUESTED],
    produces: [EventTypes.CONDITION_EVALUATED],
    lockScope: "BLUEPRINT",
    retryPolicy: "STANDARD",
    timeoutMs: 10_000,
    queue: WorkerQueues.CONDITION_EVALUATION,
  },
  ControlWorker: {
    name: "ControlWorker",
    consumes: [EventTypes.CONDITION_EVALUATED],
    produces: [EventTypes.ENFORCEMENT_PACKAGE_CREATED, EventTypes.TASK_GENERATION_REQUESTED],
    lockScope: "BLUEPRINT",
    retryPolicy: "STANDARD",
    timeoutMs: 10_000,
    queue: WorkerQueues.ENFORCEMENT_PACKAGE,
  },
  TaskGenerationWorker: {
    name: "TaskGenerationWorker",
    consumes: [EventTypes.TASK_GENERATION_REQUESTED],
    produces: [EventTypes.TASK_GENERATION_COMPLETED, EventTypes.TASK_GENERATION_FAILED],
    lockScope: "BLUEPRINT",
    retryPolicy: "STANDARD",
    timeoutMs: 30_000,
    queue: WorkerQueues.TASK_GENERATION,
  },
  TaskGuaranteeWorker: {
    name: "TaskGuaranteeWorker",
    consumes: [EventTypes.TASK_GENERATION_COMPLETED, EventTypes.TASK_GENERATION_FAILED],
    produces: [EventTypes.ORDER_AVAILABLE],
    lockScope: "BLUEPRINT",
    retryPolicy: "CRITICAL",
    timeoutMs: 15_000,
    queue: WorkerQueues.TASK_GUARANTEE,
  },
  InactivityWorker: {
    name: "InactivityWorker",
    consumes: [EventTypes.INACTIVITY_SCAN_REQUESTED],
    produces: [
      EventTypes.INACTIVITY_DETECTED,
      EventTypes.ABANDONMENT_RISK,
      EventTypes.RECOVERY_TASK_REQUESTED,
    ],
    lockScope: "USER",
    retryPolicy: "STANDARD",
    timeoutMs: 20_000,
    queue: WorkerQueues.INACTIVITY_SCAN,
  },
  ProjectionWorker: {
    name: "ProjectionWorker",
    consumes: [EventTypes.STATE_CHANGED, EventTypes.ORDER_AVAILABLE],
    produces: [EventTypes.PROJECTION_REFRESH_REQUESTED, EventTypes.DASHBOARD_REFRESH_REQUESTED],
    lockScope: "NONE",
    retryPolicy: "FAST",
    timeoutMs: 5_000,
    queue: WorkerQueues.PROJECTION_REFRESH,
  },
  BhudhiWorker: {
    name: "BhudhiWorker",
    consumes: [EventTypes.BHUDHI_TRIGGER_REQUESTED],
    produces: [EventTypes.BHUDHI_CALL_COMPLETED, EventTypes.BHUDHI_FALLBACK_USED],
    lockScope: "NONE",
    retryPolicy: "BHUDHI",
    timeoutMs: 25_000,
    queue: WorkerQueues.BHUDHI_TRIGGER,
  },
  HealthWorker: {
    name: "HealthWorker",
    consumes: [EventTypes.SYSTEM_HEALTH_DEGRADED],
    produces: [EventTypes.HEALTH_ALERT],
    lockScope: "NONE",
    retryPolicy: "FAST",
    timeoutMs: 5_000,
    queue: WorkerQueues.SYSTEM_HEALTH,
  },
  ErectorSignalBridgeWorker: {
    name: "ErectorSignalBridgeWorker",
    consumes: [EventTypes.SIGNAL_CALCULATED],
    produces: [EventTypes.ERECTOR_SIGNAL_CALCULATED],
    lockScope: "NONE",
    retryPolicy: "FAST",
    timeoutMs: 15_000,
    queue: WorkerQueues.ERECTOR_SIGNAL_BRIDGE,
  },
  ErectorSimulationSignalWorker: {
    name: "ErectorSimulationSignalWorker",
    consumes: [EventTypes.ERECTOR_SIGNAL_CALCULATED],
    produces: [EventTypes.ERECTOR_RESIMULATION_TRIGGERED],
    lockScope: "NONE",
    retryPolicy: "FAST",
    timeoutMs: 15_000,
    queue: WorkerQueues.ERECTOR_SIMULATION_REQUESTED,
  },
  ErectorBaselineWorker: {
    name: "ErectorBaselineWorker",
    consumes: [EventTypes.ERECTOR_BASELINE_REQUESTED],
    produces: [EventTypes.ERECTOR_BASELINE_COMPLETED, EventTypes.BLUEPRINT_EXECUTION_GENERATION_REQUESTED],
    lockScope: "BLUEPRINT",
    retryPolicy: "CRITICAL",
    timeoutMs: 30_000,
    queue: WorkerQueues.ERECTOR_BASELINE,
  },
  BlueprintExecutionGenerationWorker: {
    name: "BlueprintExecutionGenerationWorker",
    consumes: [EventTypes.BLUEPRINT_EXECUTION_GENERATION_REQUESTED],
    produces: [EventTypes.BLUEPRINT_EXECUTION_GENERATION_COMPLETED, EventTypes.EXECUTION_UNLOCKED],
    lockScope: "BLUEPRINT",
    retryPolicy: "CRITICAL",
    timeoutMs: 60_000,
    queue: WorkerQueues.BLUEPRINT_EXECUTION_GENERATION,
  },
};

const EVENT_TO_WORKER = new Map<string, Doc16WorkerDefinition>();
for (const worker of Object.values(WORKER_REGISTRY)) {
  for (const eventType of worker.consumes) {
    EVENT_TO_WORKER.set(eventType, worker);
  }
}

export function getWorkerForEventType(eventType: string): Doc16WorkerDefinition | undefined {
  return EVENT_TO_WORKER.get(eventType);
}

export function getWorkerByName(name: string): Doc16WorkerDefinition | undefined {
  return WORKER_REGISTRY[name];
}

export function listDoc16Workers(): Doc16WorkerDefinition[] {
  return Object.values(WORKER_REGISTRY);
}

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
