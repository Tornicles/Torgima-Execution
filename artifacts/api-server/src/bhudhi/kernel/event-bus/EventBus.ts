import { EventEmitter } from "node:events";
import type { EventHandler, KernelEventInput, StoredKernelEvent } from "../contracts/types.js";
import {
  cleanupOldKernelEvents,
  getEventChain,
  markEventProcessed,
  persistKernelEvent,
} from "../kernelData.js";
import { logger } from "../../../lib/logger.js";

/**
 * Event Bus — engines communicate via persisted events + in-process subscribers.
 */
export class EventBus extends EventEmitter {
  private queue: StoredKernelEvent[] = [];
  private draining = false;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /** Publish event to bus (named publish to avoid clashing with EventEmitter.emit). */
  async publish(input: KernelEventInput): Promise<string> {
    const stored = await persistKernelEvent(input);
    this.queue.push(stored);

    if (!this.draining) {
      void this.drainQueue();
    }

    return stored.id;
  }

  subscribe(eventType: string, handler: EventHandler, handlerName?: string): void {
    super.on(eventType, async (event: StoredKernelEvent) => {
      try {
        await handler(event);
        await markEventProcessed(event.id, handlerName ?? eventType, "completed");
      } catch (err) {
        logger.error({ err, eventId: event.id, eventType }, "[EventBus] handler failed");
        await markEventProcessed(event.id, handlerName ?? eventType, "failed");
      }
    });
  }

  private async drainQueue(): Promise<void> {
    this.draining = true;

    while (this.queue.length > 0) {
      const event = this.queue.shift();
      if (event) {
        super.emit(event.eventType, event);
        super.emit("*", event);
      }
    }

    this.draining = false;
  }

  async getChain(chainId: string): Promise<StoredKernelEvent[]> {
    return getEventChain(chainId);
  }

  async cleanup(daysOld = 7): Promise<number> {
    return cleanupOldKernelEvents(daysOld);
  }
}

export const eventBus = new EventBus();
