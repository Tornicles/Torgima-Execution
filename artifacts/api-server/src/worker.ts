/**
 * Cloudflare Workers entry — wraps existing Express API without rewriting routes.
 */

import { createServer } from "node:http";
import { handleAsNodeRequest } from "cloudflare:node";
import type { ExecutionContext, MessageBatch, ScheduledController } from "@cloudflare/workers-types";
import express from "express";
import { bindCloudflareEnv, type TorgimaQueueMessage, type TorgimaWorkerEnv } from "./lib/cloudflare-runtime.js";
import { createCorsMiddleware, isAllowedOrigin } from "./lib/cors.js";
import { handleQueueBatch } from "./queues/handler.js";
import { handleCloudflareCron } from "./schedulers/cloudflare-cron.js";

const HTTP_PORT = 8080;

type FetchHandler = (
  request: Request,
  env: TorgimaWorkerEnv,
  ctx: ExecutionContext,
) => Response | Promise<Response>;

let cachedFetch: FetchHandler | null = null;

function mountHealthRoute(root: express.Express): void {
  root.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      status: "healthy",
      readiness: "liveness_only",
      service: "torgima-api",
      runtime: "cloudflare-workers",
      hint: "Use GET /api/health with x-internal-auth for deep readiness",
    });
  });
}

async function createFetchHandler(): Promise<FetchHandler> {
  const root = express();
  root.disable("x-powered-by");
  root.use(createCorsMiddleware());
  mountHealthRoute(root);

  try {
    const { createApp } = await import("./app.js");
    const apiApp = await createApp();
    root.use(apiApp);
  } catch (err) {
    console.error("[worker] API app failed to load — /health still available:", err);
  }

  const server = createServer(root);

  // Await server ready so the first request does not hit ECONNREFUSED.
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", (err) => {
      // EADDRINUSE on a warm isolate — server is already listening; safe to continue.
      if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
        resolve();
      } else {
        reject(err);
      }
    });
    server.listen(HTTP_PORT);
  });

  return (request) => handleAsNodeRequest(HTTP_PORT, request);
}

async function getFetchHandler(): Promise<FetchHandler> {
  if (!cachedFetch) {
    cachedFetch = await createFetchHandler();
  }
  return cachedFetch;
}

/** Bare /health for workers.dev CI probes — must not depend on Express boot. */
function healthProbeResponse(): Response {
  return Response.json({
    ok: true,
    status: "healthy",
    readiness: "liveness_only",
    service: "torgima-api",
    runtime: "cloudflare-workers",
    hint: "Use GET /api/health with x-internal-auth for deep readiness",
  });
}

/**
 * Build a CORS-safe error Response for when the Worker itself fails before Express
 * can set headers. Never expose internal details to the client.
 */
function workerErrorResponse(request: Request, status: number, code: string, message: string): Response {
  const origin = request.headers.get("origin") ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Vary"] = "Origin";
  }
  return new Response(
    JSON.stringify({ ok: false, error: { code, message } }),
    { status, headers },
  );
}

export default {
  async fetch(request: Request, env: TorgimaWorkerEnv, ctx: ExecutionContext): Promise<Response> {
    // bindCloudflareEnv MUST run before getFetchHandler so process.env is populated
    // before any route module or middleware reads it.
    bindCloudflareEnv(env);

    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/health") {
      return healthProbeResponse();
    }

    try {
      const handler = await getFetchHandler();
      const response = await handler(request, env, ctx);

      // Final CORS safety net: if the Express response is missing the ACAO header
      // (e.g. the built-in Express finalhandler fired instead of our error handler,
      // or an async middleware threw before the CORS middleware ran its setHeader call),
      // patch the header here before returning to the browser.
      // This runs on EVERY response so it also covers 4xx/5xx that bypass app.ts.
      const origin = request.headers.get("origin") ?? "";
      if (isAllowedOrigin(origin) && !response.headers.get("Access-Control-Allow-Origin")) {
        const patchedHeaders = new Headers(response.headers);
        patchedHeaders.set("Access-Control-Allow-Origin", origin);
        patchedHeaders.set("Access-Control-Allow-Credentials", "true");
        patchedHeaders.set("Vary", "Origin");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: patchedHeaders,
        });
      }

      return response;
    } catch (err) {
      // The Express server failed to start or crashed processing the request.
      // Return a CORS-safe error so the browser does not get a raw Cloudflare page
      // with no Access-Control-Allow-Origin header.
      console.error(
        JSON.stringify({
          type: "worker_fetch_error",
          path: pathname,
          errorClass: err instanceof Error ? err.constructor?.name : "unknown",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      return workerErrorResponse(
        request,
        500,
        "INTERNAL_ERROR",
        "Service temporarily unavailable. Please try again.",
      );
    }
  },

  async queue(batch: MessageBatch<TorgimaQueueMessage>, env: TorgimaWorkerEnv): Promise<void> {
    bindCloudflareEnv(env);
    await handleQueueBatch(batch, env);
  },

  async scheduled(controller: ScheduledController, env: TorgimaWorkerEnv): Promise<void> {
    bindCloudflareEnv(env);
    await handleCloudflareCron(controller, env);
  },
};
