import type { Server } from "node:http";
import app from "./app.js";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger.js";
import { startWorkers } from "./workers/start.js";
import { stopBoss } from "./lib/queue.js";
import { stopProductionSchedulers } from "./schedulers/ProductionScheduler.js";
import { runMigrationPreflight } from "./lib/migrationPreflight.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

let server: Server | null = null;

async function bootstrap(): Promise<void> {
  try {
    await runMigrationPreflight();
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("[SERVER] Database connection: OK");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SERVER] Startup preflight FAILED:", msg);
    process.exit(1);
  }

  // Railway/Docker must listen on 0.0.0.0 — binding only to localhost breaks the edge proxy (502 + ~15s timeout).
  const HOST = process.env.HOST ?? "0.0.0.0";
  server = app.listen(PORT, HOST, () => {
    console.log(`[SERVER] Running on http://${HOST}:${PORT}`);
    console.log(`[SERVER] NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[SERVER] DATABASE_URL set: ${!!process.env.DATABASE_URL}`);

    startWorkers().catch((workerErr) => {
      logger.error({ err: workerErr }, "Failed to start workers");
    });
  });
}

process.on("unhandledRejection", (reason) => {
  logger.error(
    { err: reason instanceof Error ? reason : String(reason) },
    "[SERVER] Unhandled promise rejection",
  );
});

void bootstrap();

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
