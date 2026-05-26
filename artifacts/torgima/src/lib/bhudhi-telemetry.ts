import { postTelemetryEvents } from "@/lib/bhudhi-launch-api";

const buffer: Array<{
  event: string;
  blueprintId?: string;
  properties?: Record<string, unknown>;
}> = [];

const FLUSH_SIZE = 20;

export function trackBhudhiEvent(
  event: string,
  opts?: { blueprintId?: string; properties?: Record<string, unknown> },
) {
  buffer.push({
    event,
    blueprintId: opts?.blueprintId,
    properties: opts?.properties,
  });
  if (buffer.length >= FLUSH_SIZE) {
    void flushBhudhiTelemetry();
  }
}

export async function flushBhudhiTelemetry() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    await postTelemetryEvents(batch);
  } catch {
    // telemetry must not break UX
  }
}
