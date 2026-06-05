/**
 * Cloudflare Queues producer adapter — drop-in for pg-boss send() on Workers.
 */

import type { TorgimaQueueMessage } from "./cloudflare-runtime.js";
import { logger } from "./logger.js";

export class CloudflareQueueProducer {
  on(_event: string, _handler: (error: Error) => void): void {
    // pg-boss compatibility no-op
  }

  async start(): Promise<void> {
    logger.info("[Queue] Cloudflare Queues producer ready");
  }

  async stop(): Promise<void> {
    // no-op
  }

  async createQueue(_name: string): Promise<void> {
    // Queues are provisioned in wrangler.jsonc
  }

  async schedule(
    _queue: string,
    _cron: string,
    _payload: unknown,
    _options?: unknown,
  ): Promise<void> {
    // Cron schedules run via wrangler triggers + worker.scheduled() on Cloudflare
  }

  async send(queue: string, payload: unknown, _options?: unknown): Promise<string | null> {
    const binding = globalThis.__TORGIMA_TASK_QUEUE__;
    if (!binding) {
      throw new Error("[Queue] TASK_QUEUE binding is not configured");
    }
    const message: TorgimaQueueMessage = { queue, payload };
    await binding.send(message);
    return `cf:${queue}:${Date.now()}`;
  }

  async work(
    _queue: string,
    _options?: unknown,
    _handler?: unknown,
  ): Promise<string> {
    // Consumers run in worker.queue(), not in-process work()
    return "cloudflare-queue-consumer";
  }
}
