/**
 * Entry: bind HTTP on 0.0.0.0 immediately (Railway health/proxy), then load API routes in background.
 */
import type { Server } from "node:http";
import express from "express";
import { createCorsMiddleware } from "./lib/cors.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = "0.0.0.0";

const root = express();

root.get("/health", (_req, res) => {
  res.json({ ok: true });
});

root.use(createCorsMiddleware());

let server: Server | null = null;

function startListening(): Server {
  server = root.listen(PORT, HOST, () => {
    console.log(`[SERVER START] Listening on http://${HOST}:${PORT}`);
    console.log("[HEALTH READY] GET /health");

    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      console.error(
        "[SERVER] DATABASE_URL is not set — API routes not loaded (health-only mode)",
      );
      return;
    }

    void import("./boot.js")
      .then(async ({ attachApiApp, runBackgroundStartup, shutdown }) => {
        await attachApiApp(root);
        process.on("SIGTERM", () => void shutdown(server!, "SIGTERM"));
        process.on("SIGINT", () => void shutdown(server!, "SIGINT"));
        await runBackgroundStartup();
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[SERVER] Boot failed (health still available):", msg);
      });
  });

  server.on("error", (err) => {
    console.error("[SERVER] HTTP server error:", err);
    process.exit(1);
  });

  return server;
}

process.on("unhandledRejection", (reason) => {
  console.error("[SERVER] Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[SERVER] Uncaught exception:", err);
});

startListening();
