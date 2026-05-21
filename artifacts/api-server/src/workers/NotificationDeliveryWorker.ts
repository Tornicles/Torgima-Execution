import { logger } from "../lib/logger.js";
import { processNotificationQueue } from "../engines/notifications/NotificationDeliveryEngine.js";

const POLL_MS = 60_000;

async function tick() {
  try {
    const n = await processNotificationQueue(40);
    if (n > 0) logger.info({ count: n }, "[NotificationDeliveryWorker] Processed queue");
  } catch (err) {
    logger.warn({ err }, "[NotificationDeliveryWorker] Poll failed");
  }
}

export function startNotificationDeliveryPoller() {
  void tick();
  setInterval(() => void tick(), POLL_MS);
  logger.info("[NotificationDeliveryWorker] Poller started");
}
