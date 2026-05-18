import { updateStateDrift } from "../engines/world-model/WorldModelEngine.js";
import { logger } from "../lib/logger.js";

export async function runWorldStateUpdate(userId: string): Promise<{ stateVersion: number }> {
  const state = await updateStateDrift(userId);
  logger.info({ userId, stateVersion: state.stateVersion }, "[WorldStateWorker] Drift update");
  return { stateVersion: state.stateVersion };
}
