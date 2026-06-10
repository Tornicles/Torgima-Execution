/**
 * Cloudflare Workers runtime bridge — maps bindings to process.env for existing Node code.
 * Infrastructure only; no business-logic changes.
 */

import type { Hyperdrive, KVNamespace, Queue } from "@cloudflare/workers-types";
import { bindWorkerDatabaseUrl, resetWorkerDbCache } from "@workspace/db";

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
    "EVENT_DISPATCH_CRON_BATCH_SIZE",
    "EVENT_DISPATCH_CRON_ENABLED",
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

  // Some Cloudflare dashboards store these with the VITE_ prefix that was
  // originally set for the frontend Pages build.  Accept both names so the
  // Worker works regardless of how the secrets were named in the dashboard.
  if (!process.env.SUPABASE_URL) {
    const viteUrl = env["VITE_SUPABASE_URL"];
    if (typeof viteUrl === "string" && viteUrl.trim()) {
      process.env.SUPABASE_URL = viteUrl.trim();
    }
  }
  if (!process.env.SUPABASE_ANON_KEY) {
    const viteAnon = env["VITE_SUPABASE_ANON_KEY"];
    if (typeof viteAnon === "string" && viteAnon.trim()) {
      process.env.SUPABASE_ANON_KEY = viteAnon.trim();
    }
  }

  if (nextDbUrl) {
    if (nextDbUrl !== previousDbUrl && nextDbUrl !== lastBoundDatabaseUrl) {
      lastBoundDatabaseUrl = nextDbUrl;
      resetWorkerDbCache();
    }
    bindWorkerDatabaseUrl(nextDbUrl);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[cloudflare-runtime] Env bound. DATABASE_URL present:",
      Boolean(env.DATABASE_URL || env.HYPERDRIVE),
    );
  }
}
