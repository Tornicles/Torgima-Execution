import { logger } from "../lib/logger.js";
import { runHourlyIntegrationSync } from "../engines/integrations/IntegrationsEngine.js";

const POLL_MS = 60 * 60 * 1000;

export function startIntegrationsSyncPoller() {
  void runHourlyIntegrationSync().catch((err) =>
    logger.warn({ err }, "[IntegrationsSyncWorker] Initial sync failed"),
  );
  setInterval(() => {
    void runHourlyIntegrationSync().catch((err) =>
      logger.warn({ err }, "[IntegrationsSyncWorker] Hourly sync failed"),
    );
  }, POLL_MS);
  logger.info("[IntegrationsSyncWorker] Poller started (1h interval)");
}
