/**
 * GAP G8 — normalize external payloads into a standard envelope (Phase 1 passthrough).
 */

export async function normalizeExternalPayload(
  sourceName: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return {
    source: sourceName,
    data: payload,
    normalized_at: new Date().toISOString(),
  };
}
