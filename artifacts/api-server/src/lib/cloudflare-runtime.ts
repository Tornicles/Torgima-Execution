/**
 * Cloudflare Workers runtime bridge — maps bindings to process.env for existing Node code.
 * Infrastructure only; no business-logic changes.
 */

import type { Hyperdrive, KVNamespace, Queue } from "@cloudflare/workers-types";
import { resetWorkerDbCache } from "@workspace/db";

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

let lastBoundDatabaseUrl: string | undefined;

export function bindCloudflareEnv(env: TorgimaWorkerEnv): void {
  if (typeof env.NODE_ENV === "string" && env.NODE_ENV.trim()) {
    process.env.NODE_ENV = env.NODE_ENV.trim();
  }
  if (typeof env.TORGIMA_RUNTIME === "string" && env.TORGIMA_RUNTIME.trim()) {
    process.env.TORGIMA_RUNTIME = env.TORGIMA_RUNTIME.trim();
  }
  process.env.START_WORKERS = "false";

  const previousDbUrl = process.env.DATABASE_URL;
  let nextDbUrl: string | undefined;

  if (env.HYPERDRIVE) {
    globalThis.__TORGIMA_HYPERDRIVE__ = env.HYPERDRIVE;
    nextDbUrl = env.HYPERDRIVE.connectionString;
    process.env.DATABASE_URL = nextDbUrl;
  } else if (typeof env.DATABASE_URL === "string" && env.DATABASE_URL.trim()) {
    nextDbUrl = env.DATABASE_URL.trim();
    process.env.DATABASE_URL = nextDbUrl;
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
    "FRONTEND_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ANTHROPIC_API_KEY",
    "BHUDHI_MODEL",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "INTERNAL_API_SECRET",
    "INTERNAL_AUTH_SECRET",
    "INTERNAL_SERVICE_SECRET",
    "NOTIFICATION_UNSUBSCRIBE_SECRET",
    "NEXTAUTH_SECRET",
    "SESSION_SECRET",
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

  if (nextDbUrl && nextDbUrl !== previousDbUrl && nextDbUrl !== lastBoundDatabaseUrl) {
    lastBoundDatabaseUrl = nextDbUrl;
    resetWorkerDbCache();
  }
}
