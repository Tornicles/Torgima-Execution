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

function isCloudflareWorkerRuntime(): boolean {
  return process.env.TORGIMA_RUNTIME === "cloudflare";
}

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("[DB] DATABASE_URL is not set");
  }
  return connectionString;
}

function withPoolerParams(url: string): string {
  if (/pgbouncer=true|pooler\.supabase\.com|:6543/.test(url)) {
    return url;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}pgbouncer=true&connection_limit=1`;
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

export function getDb(): DbInstance {
  if (!dbInstance) {
    const connectionString = getConnectionString();

    if (isCloudflareWorkerRuntime()) {
      const workerUrl = withPoolerParams(connectionString);
      postgresJsClient = postgres(workerUrl, {
        max: 1,
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false,
        ssl: resolvePgSsl(connectionString) ? "require" : false,
      });
      dbInstance = drizzlePostgresJs(postgresJsClient, { schema }) as unknown as DbInstance;
    } else {
      dbInstance = drizzleNodePg(getPool(), { schema });
    }
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
