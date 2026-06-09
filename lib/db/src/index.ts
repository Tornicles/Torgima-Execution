import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import pg from "pg";
import postgres from "postgres";
import * as schema from "./schema";
import { resolvePgSsl, stripSslModeFromConnectionString } from "./pg-ssl";

const { Pool } = pg;

export { resolvePgSsl, stripSslModeFromConnectionString };

type DbInstance = ReturnType<typeof drizzleNodePg<typeof schema>>;

let poolInstance: pg.Pool | null = null;
let postgresJsClient: ReturnType<typeof postgres> | null = null;
let dbInstance: DbInstance | null = null;
let workerBoundDatabaseUrl: string | undefined;

declare global {
  // eslint-disable-next-line no-var
  var __TORGIMA_WORKER_DATABASE_URL__: string | undefined;
}

function isCloudflareWorkerRuntime(): boolean {
  return process.env.TORGIMA_RUNTIME === "cloudflare";
}

/** Bind Worker c.env.DATABASE_URL — not a persistent pool; refreshes client when URL changes. */
export function bindWorkerDatabaseUrl(url: string | undefined): void {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (!trimmed) return;
  globalThis.__TORGIMA_WORKER_DATABASE_URL__ = trimmed;
  if (workerBoundDatabaseUrl !== trimmed) {
    resetWorkerDbCache();
    workerBoundDatabaseUrl = trimmed;
  }
}

function getConnectionString(): string {
  const connectionString =
    globalThis.__TORGIMA_WORKER_DATABASE_URL__?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("[DB] DATABASE_URL is not set");
  }
  return connectionString;
}

/** Supabase + serverless: transaction pooler (6543), pgbouncer, no prepared statements. */
export function normalizeWorkerDatabaseUrl(connectionString: string): string {
  let url = stripSslModeFromConnectionString(connectionString.trim());
  try {
    const parsed = new URL(url.replace(/^postgresql:/i, "postgres:"));
    if (parsed.hostname.includes("pooler.supabase.com") && (!parsed.port || parsed.port === "5432")) {
      parsed.port = "6543";
    }
    if (!parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "1");
    }
    url = parsed.toString().replace(/^postgres:/i, "postgresql:");
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    if (!/pgbouncer=true/.test(url)) {
      url = `${url}${sep}pgbouncer=true&connection_limit=1`;
    }
  }
  return url;
}

export function getPool(): pg.Pool {
  if (isCloudflareWorkerRuntime()) {
    throw new Error("[DB] pg.Pool is not available on Cloudflare Workers — use getDb()");
  }
  if (!poolInstance) {
    const connectionString = getConnectionString();
    const poolConnectionString = stripSslModeFromConnectionString(connectionString);
    poolInstance = new Pool({
      connectionString: poolConnectionString,
      ssl: resolvePgSsl(connectionString),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    poolInstance.on("error", (err) => {
      process.stderr.write(`[DB] Pool error: ${err.message}\n`);
    });
  }
  return poolInstance;
}

/** Clear cached clients when Worker env bindings change (e.g. DATABASE_URL secret added). */
export function resetWorkerDbCache(): void {
  if (postgresJsClient) {
    void postgresJsClient.end({ timeout: 1 }).catch(() => undefined);
  }
  postgresJsClient = null;
  dbInstance = null;
  poolInstance = null;
  workerBoundDatabaseUrl = undefined;
}

export function getDb(): DbInstance {
  if (isCloudflareWorkerRuntime()) {
    bindWorkerDatabaseUrl(process.env.DATABASE_URL);
    const connectionString = getConnectionString();
    if (dbInstance && workerBoundDatabaseUrl === connectionString) {
      return dbInstance;
    }
    resetWorkerDbCache();
    workerBoundDatabaseUrl = connectionString;

    const workerUrl = normalizeWorkerDatabaseUrl(connectionString);
    const sslConfig = resolvePgSsl(connectionString);
    postgresJsClient = postgres(workerUrl, {
      max: 1,
      idle_timeout: 0,
      connect_timeout: 15,
      prepare: false,
      ssl: sslConfig
        ? typeof sslConfig === "object"
          ? sslConfig
          : "require"
        : false,
    });
    dbInstance = drizzlePostgresJs(postgresJsClient, { schema }) as unknown as DbInstance;
    return dbInstance;
  }

  if (!dbInstance) {
    dbInstance = drizzleNodePg(getPool(), { schema });
  }
  return dbInstance;
}

/** Lazy pool — Node/Railway only. */
export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getPool(), prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(getPool()) : value;
  },
});

/** Lazy drizzle client — postgres-js on Workers, node-postgres elsewhere. */
export const db = new Proxy({} as DbInstance, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getDb(), prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(getDb()) : value;
  },
});

export * from "./schema";
