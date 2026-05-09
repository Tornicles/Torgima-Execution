import { PgBoss } from "pg-boss";
import { logger } from "./logger.js";

const globalForBoss = globalThis as unknown as {
  boss: PgBoss | undefined;
};

export function createBoss(): PgBoss {
  return new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
    monitorIntervalSeconds: 30,
  });
}

export async function getBoss(): Promise<PgBoss> {
  if (!globalForBoss.boss) {
    globalForBoss.boss = createBoss();
    globalForBoss.boss.on("error", (error: Error) => {
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
