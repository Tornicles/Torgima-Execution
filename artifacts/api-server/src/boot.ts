import type { Server } from "node:http";
import app from "./app.js";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger.js";
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

async function maybeApplyManualMigrations(): Promise<void> {
  if (process.env.RUN_DB_APPLY_MANUAL_ON_START !== "true") return;
  try {
    const { spawn } = await import("node:child_process");
    const root = process.env.RAILWAY_PROJECT_ROOT ?? process.cwd();
    await new Promise<void>((resolve, reject) => {
      const child = spawn("pnpm", ["db:apply-manual"], {
        cwd: root,
        stdio: "inherit",
        shell: true,
        env: process.env,
      });
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`db:apply-manual exit ${code}`))));
      child.on("error", reject);
    });
    logger.info("[SERVER] Background db:apply-manual finished");
  } catch (err) {
    logger.warn({ err }, "[SERVER] Background db:apply-manual failed (non-fatal)");
  }
}

async function runBackgroundStartup(): Promise<void> {
  void maybeApplyManualMigrations();

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
    logger.error(
      { err: msg },
      "[SERVER] Startup checks failed — API stays up for health/CORS; fix DATABASE_URL and run db:apply-manual",
    );
    return;
  }

  if (workersStarted || process.env.START_WORKERS === "false") {
    if (process.env.START_WORKERS === "false") {
      logger.warn("[SERVER] START_WORKERS=false — queue workers skipped");
    }
    return;
  }
  workersStarted = true;
  const delayMs = parseInt(process.env.WORKER_START_DELAY_MS ?? "15000", 10);
  setTimeout(() => {
    import("./workers/start.js")
      .then(({ startWorkers }) => startWorkers())
      .catch((workerErr) => {
        logger.error({ err: workerErr }, "Failed to start workers");
      });
  }, delayMs);
  logger.info({ delayMs }, "[SERVER] Workers scheduled to start after delay");
}

export function startHttpServer(): Server {
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

  return server;
}

export async function shutdown(signal: string): Promise<void> {
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
