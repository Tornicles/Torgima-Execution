import { bhudhiProtocol } from "./BhudhiProtocol.js";
import { logger } from "../../lib/logger.js";

/** Dual-write kernel pipeline step as BHUDHI:// protocol message (non-blocking). */
export async function recordProtocolStep(
  blueprintId: string,
  from: string,
  to: string,
  uri: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  try {
    const message = bhudhiProtocol.createMessage(from, to, uri, payload, "event");
    return await bhudhiProtocol.send(blueprintId, message);
  } catch (err) {
    logger.warn({ err, blueprintId, uri }, "[Protocol] record step skipped");
    return null;
  }
}
