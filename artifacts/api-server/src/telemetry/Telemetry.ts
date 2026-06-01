import { getEnvironment } from "../config/environments.js";
import { logger } from "../lib/logger.js";

export interface TelemetryEvent {
  event: string;
  userId?: string;
  blueprintId?: string;
  properties?: Record<string, unknown>;
  timestamp: Date;
}

const MAX_BUFFER = 100;
const MAX_EVENTS_PER_REQUEST = 50;

/** In-process telemetry buffer; server ingests via POST /api/telemetry. */
export class Telemetry {
  private enabled: boolean;
  private sampleRate: number;
  private events: TelemetryEvent[] = [];

  constructor() {
    const env = getEnvironment();
    this.enabled = env.telemetry.enabled;
    this.sampleRate = env.telemetry.sampleRate;
  }

  track(event: Omit<TelemetryEvent, "timestamp">) {
    if (!this.enabled) return;
    if (this.sampleRate <= 0) return;
    if (Math.random() > this.sampleRate) return;

    this.events.push({ ...event, timestamp: new Date() });
    if (this.events.length >= MAX_BUFFER) {
      void this.flush();
    }
  }

  /** Drain buffer for API ingestion (no outbound fetch from server process). */
  drain(): TelemetryEvent[] {
    const batch = [...this.events];
    this.events = [];
    return batch;
  }

  ingest(events: TelemetryEvent[]) {
    if (!this.enabled || events.length === 0) return;
    for (const e of events.slice(0, MAX_EVENTS_PER_REQUEST)) {
      logger.info(
        {
          event: e.event,
          userId: e.userId,
          blueprintId: e.blueprintId,
          at: e.timestamp instanceof Date ? e.timestamp.toISOString() : e.timestamp,
        },
        "[bhudhi:telemetry]",
      );
    }
  }

  private async flush() {
    const batch = this.drain();
    if (batch.length === 0) return;
    this.ingest(batch);
  }
}

export const telemetry = new Telemetry();
