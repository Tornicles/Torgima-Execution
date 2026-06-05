/**
 * Cloudflare Workers runtime bridge — maps bindings to process.env for existing Node code.
 * Infrastructure only; no business-logic changes.
 */

import type { Hyperdrive, KVNamespace, Queue } from "@cloudflare/workers-types";

export type TorgimaWorkerEnv = {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  APP_URL?: string;
  HYPERDRIVE?: Hyperdrive;
  SESSIONS?: KVNamespace;
  TASK_QUEUE?: Queue<TorgimaQueueMessage>;
  ANTHROPIC_API_KEY?: string;
  RESEND_API_KEY?: string;
  INTERNAL_API_SECRET?: string;
  NEXTAUTH_SECRET?: string;
  SESSION_SECRET?: string;
  [key: string]: unknown;
};

export type TorgimaQueueMessage = {
  queue: string;
  payload: unknown;
};

declare global {
  // eslint-disable-next-line no-var
  var __TORGIMA_TASK_QUEUE__: Queue<TorgimaQueueMessage> | undefined;
  // eslint-disable-next-line no-var
  var __TORGIMA_SESSIONS_KV__: KVNamespace | undefined;
  // eslint-disable-next-line no-var
  var __TORGIMA_HYPERDRIVE__: Hyperdrive | undefined;
}

export function isCloudflareRuntime(): boolean {
  return process.env.TORGIMA_RUNTIME === "cloudflare";
}

export function bindCloudflareEnv(env: TorgimaWorkerEnv): void {
  process.env.TORGIMA_RUNTIME = "cloudflare";
  process.env.NODE_ENV = env.NODE_ENV ?? "production";
  process.env.START_WORKERS = "false";

  if (env.HYPERDRIVE) {
    globalThis.__TORGIMA_HYPERDRIVE__ = env.HYPERDRIVE;
    process.env.DATABASE_URL = env.HYPERDRIVE.connectionString;
  } else if (typeof env.DATABASE_URL === "string") {
    process.env.DATABASE_URL = env.DATABASE_URL;
  }

  if (env.SESSIONS) {
    globalThis.__TORGIMA_SESSIONS_KV__ = env.SESSIONS;
    process.env.TORGIMA_KV_SESSIONS = "true";
  }

  if (env.TASK_QUEUE) {
    globalThis.__TORGIMA_TASK_QUEUE__ = env.TASK_QUEUE;
    process.env.TORGIMA_CF_QUEUES = "true";
  }

  const passthrough = [
    "APP_URL",
    "ANTHROPIC_API_KEY",
    "RESEND_API_KEY",
    "INTERNAL_API_SECRET",
    "NEXTAUTH_SECRET",
    "SESSION_SECRET",
    "EMAIL_FROM",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
    "ADMIN_SESSION_SECRET",
  ] as const;

  for (const key of passthrough) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) {
      process.env[key] = value;
    }
  }
}
