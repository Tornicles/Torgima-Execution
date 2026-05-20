import { PgBoss } from "pg-boss";
import { resolvePgSsl, stripSslModeFromConnectionString } from "@workspace/db";
import { logger } from "./logger.js";

const globalForBoss = globalThis as unknown as {
  boss: PgBoss | undefined;
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

export async function getBoss(): Promise<PgBoss> {
  if (!globalForBoss.boss) {
    globalForBoss.boss = createBoss();
    globalForBoss.boss.on("error", (error: Error) => {
      console.error("[Queue] pg-boss error:", error.message);
      logger.error({ err: error }, "pg-boss error");
    });
    await globalForBoss.boss.start();
    logger.info("pg-boss queue started");
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
