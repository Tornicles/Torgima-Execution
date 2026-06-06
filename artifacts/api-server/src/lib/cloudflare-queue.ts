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
    const message: TorgimaQueueMessage = { queue, payload };
    const binding = globalThis.__TORGIMA_TASK_QUEUE__;
    if (binding) {
      await binding.send(message);
      return `cf:${queue}:${Date.now()}`;
    }

    // No queue binding — run handler in-process (Workers Phase 2 fallback).
    const { dispatchQueueMessage } = await import("../queues/handler.js");
    await dispatchQueueMessage(message);
    logger.debug({ queue }, "[Queue] Inline handler completed (no TASK_QUEUE binding)");
    return `inline:${queue}:${Date.now()}`;
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
