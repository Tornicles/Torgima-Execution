import { PgBoss } from "pg-boss";
import { resolvePgSsl, stripSslModeFromConnectionString } from "@workspace/db";
import { CloudflareQueueProducer } from "./cloudflare-queue.js";
import { isCloudflareRuntime } from "./cloudflare-runtime.js";
import { logger } from "./logger.js";

type QueueBoss = PgBoss | CloudflareQueueProducer;

const globalForBoss = globalThis as unknown as {
  boss: QueueBoss | undefined;
};

export function createBoss(): PgBoss {
  const connectionString = process.env.PGBOSS_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("[Queue] PGBOSS_DATABASE_URL or DATABASE_URL is not set");
  }

  return new PgBoss({
    connectionString: stripSslModeFromConnectionString(connectionString),
    ssl: resolvePgSsl(connectionString),
    max: 5,
    monitorIntervalSeconds: 30,
  });
}

/** Inline handler dispatch for test/CI when pg-boss consumers are not started. */
export function shouldUseInlineQueueDispatch(): boolean {
  return (
    process.env.WORKERS_TEST_MODE === "true" ||
    process.env.TORGIMA_INTEGRATION === "true" ||
    process.env.EVENT_INLINE_DISPATCH === "true" ||
    process.env.NODE_ENV === "test"
  );
}

export async function getBoss(): Promise<QueueBoss> {
  if (!globalForBoss.boss) {
    if (
      isCloudflareRuntime() ||
      process.env.TORGIMA_CF_QUEUES === "true" ||
      shouldUseInlineQueueDispatch()
    ) {
      globalForBoss.boss = new CloudflareQueueProducer();
      await globalForBoss.boss.start();
      logger.info("[Queue] Cloudflare Queues producer started");
    } else {
      globalForBoss.boss = createBoss();
      globalForBoss.boss.on("error", (error: Error) => {
        logger.error({ err: error, message: error.message }, "[Queue] pg-boss error");
      });
      await globalForBoss.boss.start();
      logger.info("pg-boss queue started");
    }
  }
  return globalForBoss.boss;
}

export async function stopBoss(): Promise<void> {
  if (globalForBoss.boss) {
    await globalForBoss.boss.stop();
    globalForBoss.boss = undefined;
    logger.info("pg-boss queue stopped");
  }
}
