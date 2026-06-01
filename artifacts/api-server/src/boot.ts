import type { IncomingMessage, Server, ServerResponse } from "node:http";

type NodeListener = (req: IncomingMessage, res: ServerResponse) => void;

const DB_PING_TIMEOUT_MS = parseInt(process.env.DB_PING_TIMEOUT_MS ?? "8000", 10);

let workersStarted = false;
let shutdownRegistered = false;

async function pingDatabase(): Promise<void> {
  const { pool } = await import("@workspace/db");
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
    const { logger } = await import("./lib/logger.js");
    const root = process.env.RAILWAY_PROJECT_ROOT ?? process.cwd();
    await new Promise<void>((resolve, reject) => {
      const child = spawn("pnpm", ["db:apply-manual"], {
        cwd: root,
        stdio: "inherit",
        shell: true,
        env: process.env,
      });
      child.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`db:apply-manual exit ${code}`)),
      );
      child.on("error", reject);
    });
    logger.info("[SERVER] Background db:apply-manual finished");
  } catch (err) {
    const { logger } = await import("./lib/logger.js");
    logger.warn({ err }, "[SERVER] Background db:apply-manual failed (non-fatal)");
  }
}

/** Attach Express (separate bundle) as the handler for non-/health traffic. */
export async function mountExpressApp(setListener: (fn: NodeListener) => void): Promise<void> {
  const express = (await import("express")).default;
  const { default: apiApp } = await import("./app.js");
  const app = express();
  app.use(apiApp);
  setListener((req: IncomingMessage, res: ServerResponse) => {
    app(req, res);
  });
  const { logger } = await import("./lib/logger.js");
  logger.info("[SERVER] API routes mounted");
  logger.info(
    "[SERVER] Launch routes: POST /api/v1/validations/:id/launch | POST /api/v1/validation/:id/launch | POST /api/v1/onboarding/select-blueprint | POST /api/onboarding/select-blueprint | POST /api/blueprints/:id/activate",
  );
  const { logBhudhiProviderRouting } = await import("./bhudhi/bhudhiProviders.js");
  logBhudhiProviderRouting();
}

export async function runBackgroundStartup(): Promise<void> {
  const { logger } = await import("./lib/logger.js");

  if (!process.env.DATABASE_URL?.trim()) {
    logger.warn("[SERVER] DATABASE_URL not set — skipping DB startup checks");
    return;
  }

  void maybeApplyManualMigrations();

  try {
    const { runMigrationPreflight } = await import("./lib/migrationPreflight.js");
    const preflight = await runMigrationPreflight();
    if (preflight.warnings.length > 0) {
      logger.warn({ warnings: preflight.warnings }, "[SERVER] Startup preflight warnings");
    }

    await Promise.race([
      pingDatabase(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Database ping timed out after ${DB_PING_TIMEOUT_MS}ms`)),
          DB_PING_TIMEOUT_MS,
        ),
      ),
    ]);
    logger.info("[DB READY] Database connection OK");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      { err: msg },
      "[SERVER] Startup checks failed — /health stays up; fix DATABASE_URL and run db:apply-manual",
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
    void import("./workers/start.js")
      .then(({ startWorkers }) => startWorkers())
      .catch((workerErr) => {
        logger.error({ err: workerErr }, "Failed to start workers");
      });
  }, delayMs);
  logger.info({ delayMs }, "[SERVER] Workers scheduled to start after delay");
}

export function registerShutdown(server: Server): void {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  const shutdown = async (signal: string) => {
    const { logger } = await import("./lib/logger.js");
    const { stopProductionSchedulers } = await import("./schedulers/ProductionScheduler.js");
    const { stopBoss } = await import("./lib/queue.js");
    const { pool } = await import("@workspace/db");

    logger.info({ signal }, "[SERVER] Graceful shutdown");
    stopProductionSchedulers();
    await stopBoss().catch(() => null);
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await pool.end().catch(() => null);
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
