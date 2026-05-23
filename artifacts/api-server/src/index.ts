import type { Server } from "node:http";
import app from "./app.js";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger.js";
import { startWorkers } from "./workers/start.js";
import { stopBoss } from "./lib/queue.js";
import { stopProductionSchedulers } from "./schedulers/ProductionScheduler.js";
import { runMigrationPreflight } from "./lib/migrationPreflight.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const DB_PING_TIMEOUT_MS = parseInt(process.env.DB_PING_TIMEOUT_MS ?? "8000", 10);

let server: Server | null = null;
let workersStarted = false;

async function pingDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}

async function runBackgroundStartup(): Promise<void> {
  try {
    const preflight = await runMigrationPreflight();
    if (preflight.warnings.length > 0) {
      logger.warn({ warnings: preflight.warnings }, "[SERVER] Startup preflight warnings");
    }

    await Promise.race([
      pingDatabase(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Database ping timed out after ${DB_PING_TIMEOUT_MS}ms`)), DB_PING_TIMEOUT_MS),
      ),
    ]);
    console.log("[SERVER] Database connection: OK");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "[SERVER] Startup checks failed — API stays up for health/CORS; fix DATABASE_URL and run db:apply-manual");
    return;
  }

  if (workersStarted) return;
  workersStarted = true;
  try {
    await startWorkers();
  } catch (workerErr) {
    logger.error({ err: workerErr }, "Failed to start workers");
  }
}

function bootstrap(): void {
  server = app.listen(PORT, HOST, () => {
    console.log(`[SERVER] Running on http://${HOST}:${PORT}`);
    console.log(`[SERVER] NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[SERVER] DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
    void runBackgroundStartup();
  });

  server.on("error", (err) => {
    logger.error({ err }, "[SERVER] HTTP server error");
    process.exit(1);
  });
}

process.on("unhandledRejection", (reason) => {
  logger.error(
    { err: reason instanceof Error ? reason : String(reason) },
    "[SERVER] Unhandled promise rejection",
  );
});

bootstrap();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "[SERVER] Graceful shutdown");
  stopProductionSchedulers();
  await stopBoss().catch(() => null);
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => resolve());
    });
  }
  await pool.end().catch(() => null);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
