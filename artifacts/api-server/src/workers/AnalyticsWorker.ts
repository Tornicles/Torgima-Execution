import { logger } from "../lib/logger.js";
import { runDailyAnalyticsForActiveUsers } from "../engines/analytics/AnalyticsEngine.js";

const POLL_MS = 24 * 60 * 60 * 1000;

async function tick() {
  try {
    await runDailyAnalyticsForActiveUsers();
    logger.info("[AnalyticsWorker] Daily analytics run complete");
  } catch (err) {
    logger.warn({ err }, "[AnalyticsWorker] Daily run failed");
  }
}

export function startAnalyticsPoller() {
  void tick();
  setInterval(() => void tick(), POLL_MS);
  logger.info("[AnalyticsWorker] Poller started (24h interval)");
}
