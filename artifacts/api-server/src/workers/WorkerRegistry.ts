import type { Job, WorkOptions } from "pg-boss";
import { getBoss } from "../lib/queue.js";
import { logger } from "../lib/logger.js";

export interface WorkerDefinition {
  name: string;
  queue: string;
  options?: WorkOptions;
  handler: (jobs: Job<unknown>[]) => Promise<void>;
}

const _registry: WorkerDefinition[] = [];

export const workerRegistry = {
  register(def: WorkerDefinition): void {
    _registry.push(def);
  },

  async startAll(): Promise<void> {
    const boss = await getBoss();

    // Collect unique queue names and create them before subscribing
    const uniqueQueues = [...new Set(_registry.map((d) => d.queue))];
    for (const queueName of uniqueQueues) {
      await boss.createQueue(queueName);
      logger.debug({ queue: queueName }, "[WorkerRegistry] Queue ensured");
    }

    for (const def of _registry) {
      await boss.work(def.queue, def.options ?? {}, def.handler);
      logger.info({ queue: def.queue }, `[WorkerRegistry] Registered: ${def.name}`);
    }

    logger.info(`[WorkerRegistry] ${_registry.length} workers registered`);
  },
};
