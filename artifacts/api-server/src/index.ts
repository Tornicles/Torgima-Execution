/**
 * Minimal HTTP entry — binds 0.0.0.0 immediately, then loads Express API in a separate chunk.
 */
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { assertAuthEnvOnBoot } from "./lib/auth-env.js";
import { applyCorsHeaders, applyPreflightHeaders } from "./lib/cors.js";
import { logger } from "./lib/logger.js";

try {
  assertAuthEnvOnBoot();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  logger.error({ err: msg }, "[SERVER] Auth environment validation failed");
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
}

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = "0.0.0.0";

type NodeListener = (req: IncomingMessage, res: ServerResponse) => void;

let apiListener: NodeListener | null = null;

function writeJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  applyCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    applyPreflightHeaders(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  const path = (req.url ?? "").split("?")[0];

  if (path === "/health") {
    writeJson(res, 200, { ok: true });
    return;
  }

  if (apiListener) {
    apiListener(req, res);
    return;
  }

  writeJson(res, 503, { ok: false, status: "starting" });
});

server.listen(PORT, HOST, () => {
  logger.info({ host: HOST, port: PORT }, "[SERVER START] Listening");
  logger.info("[HEALTH READY] GET /health");

  void import("./boot.js")
    .then(async ({ mountExpressApp, runBackgroundStartup, registerShutdown }) => {
      registerShutdown(server);
      await mountExpressApp((listener) => {
        apiListener = listener;
      });
      await runBackgroundStartup();
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err: msg }, "[SERVER] Boot failed (GET /health still works)");
    });
});

server.on("error", (err) => {
  logger.error({ err }, "[SERVER] HTTP server error");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "[SERVER] Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "[SERVER] Uncaught exception");
});
