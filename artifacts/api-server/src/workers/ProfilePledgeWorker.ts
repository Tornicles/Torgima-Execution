import { logger } from "../lib/logger.js";
import { runPledgeEvaluationForActiveUsers } from "../engines/profile/PublicProfileEngine.js";

const POLL_MS = 24 * 60 * 60 * 1000;

export function startProfilePledgePoller() {
  void runPledgeEvaluationForActiveUsers().catch((err) =>
    logger.warn({ err }, "[ProfilePledgeWorker] Initial run failed"),
  );
  setInterval(() => {
    void runPledgeEvaluationForActiveUsers().catch((err) =>
      logger.warn({ err }, "[ProfilePledgeWorker] Daily pledge evaluation failed"),
    );
  }, POLL_MS);
  logger.info("[ProfilePledgeWorker] Poller started (24h interval)");
}
