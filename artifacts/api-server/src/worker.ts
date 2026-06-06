/**
 * Cloudflare Workers entry — wraps existing Express API without rewriting routes.
 */

import { createServer } from "node:http";
import type { ExecutionContext, MessageBatch, ScheduledController } from "@cloudflare/workers-types";
import express from "express";
import { bindCloudflareEnv, type TorgimaQueueMessage, type TorgimaWorkerEnv } from "./lib/cloudflare-runtime.js";
import { createCorsMiddleware } from "./lib/cors.js";
import { handleQueueBatch } from "./queues/handler.js";
import { handleCloudflareCron } from "./schedulers/cloudflare-cron.js";

type FetchHandler = (
  request: Request,
  env: TorgimaWorkerEnv,
  ctx: ExecutionContext,
) => Response | Promise<Response>;

let cachedFetch: FetchHandler | null = null;

async function createFetchHandler(): Promise<FetchHandler> {
  const { default: apiApp } = await import("./app.js");
  const root = express();
  root.disable("x-powered-by");
  root.use(createCorsMiddleware());

  root.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "torgima-api", runtime: "cloudflare-worker" });
  });

  root.use(apiApp);

  const server = createServer(root);

  const { httpServerHandler } = await import("cloudflare:node:http");
  return httpServerHandler(server) as FetchHandler;
}

async function getFetchHandler(): Promise<FetchHandler> {
  if (!cachedFetch) {
    cachedFetch = await createFetchHandler();
  }
  return cachedFetch;
}

export default {
  async fetch(request: Request, env: TorgimaWorkerEnv, ctx: ExecutionContext): Promise<Response> {
    bindCloudflareEnv(env);
    const handler = await getFetchHandler();
    return handler(request, env, ctx);
  },

  async queue(batch: MessageBatch<TorgimaQueueMessage>, env: TorgimaWorkerEnv): Promise<void> {
    await handleQueueBatch(batch, env);
  },

  async scheduled(controller: ScheduledController, env: TorgimaWorkerEnv): Promise<void> {
    await handleCloudflareCron(controller, env);
  },
};
