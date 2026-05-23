/**
 * Entry point: bind HTTP immediately (Railway health/CORS) or serve a clear degraded response
 * when DATABASE_URL is missing. Heavy app + DB load happens in boot.ts only when configured.
 */
import http from "node:http";
import { applyPreflightHeaders, applyCorsHeaders } from "./lib/cors.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

function writeJson(
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function startDegradedServer(reason: string): void {
  const server = http.createServer((req, res) => {
    applyCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      applyPreflightHeaders(req, res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === "/api/healthz" || req.url === "/api/health") {
      writeJson(res, 200, {
        status: "degraded",
        database: false,
        message: reason,
      });
      return;
    }

    writeJson(res, 503, {
      status: "error",
      code: "DATABASE_URL_MISSING",
      message: reason,
    });
  });

  server.listen(PORT, HOST, () => {
    console.error(`[SERVER] Degraded mode: ${reason}`);
    console.log(`[SERVER] Listening on http://${HOST}:${PORT} (configure DATABASE_URL on Railway)`);
  });
}

process.on("unhandledRejection", (reason) => {
  console.error("[SERVER] Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[SERVER] Uncaught exception:", err);
});

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  startDegradedServer(
    "DATABASE_URL is not set on Railway. Add your Supabase connection string to the api-server service variables.",
  );
} else {
  void import("./boot.js")
    .then(({ startHttpServer, shutdown }) => {
      startHttpServer();
      process.on("SIGTERM", () => void shutdown("SIGTERM"));
      process.on("SIGINT", () => void shutdown("SIGINT"));
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[SERVER] Boot failed:", msg);
      startDegradedServer(`API boot failed: ${msg}`);
    });
}
