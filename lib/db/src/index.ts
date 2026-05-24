import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { resolvePgSsl, stripSslModeFromConnectionString } from "./pg-ssl";

const { Pool } = pg;

export { resolvePgSsl, stripSslModeFromConnectionString };

let poolInstance: pg.Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("[DB] DATABASE_URL is not set");
  }
  return connectionString;
}

export function getPool(): pg.Pool {
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
      console.error("[DB] Pool error:", err.message);
    });
  }
  return poolInstance;
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

/** Lazy pool — connects only when first used (safe for early HTTP listen). */
export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getPool(), prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(getPool()) : value;
  },
});

/** Lazy drizzle client. */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getDb(), prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(getDb()) : value;
  },
});

export * from "./schema";
