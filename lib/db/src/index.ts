import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import pg from "pg";
import postgres from "postgres";
import * as schema from "./schema";
import { resolvePgSsl, stripSslModeFromConnectionString } from "./pg-ssl";

const { Pool } = pg;

/** Vitest unit runs — no live Postgres; fail fast instead of TCP timeout. */
const VITEST_STUB_DB_MARKER = "torgima_vitest_stub";

export { resolvePgSsl, stripSslModeFromConnectionString };

export function isVitestUnitStubDatabase(): boolean {
  const integration = process.env.TORGIMA_INTEGRATION;
  if (
    typeof integration === "string" &&
    ["1", "true", "yes"].includes(integration.toLowerCase())
  ) {
    return false;
  }
  const url =
    globalThis.__TORGIMA_WORKER_DATABASE_URL__?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";
  return url.includes(VITEST_STUB_DB_MARKER);
}

function createVitestStubPool(): pg.Pool {
  const stubError = () =>
    new Error(
      "[DB] Unit test stub active — set TORGIMA_INTEGRATION=true with a real DATABASE_URL for Postgres integration tests",
    );
  const reject = async () => {
    throw stubError();
  };
  return {
    query: reject,
    connect: reject,
    end: async () => undefined,
    on: () => createVitestStubPool(),
  } as unknown as pg.Pool;
}

type DbInstance = ReturnType<typeof drizzleNodePg<typeof schema>>;

let poolInstance: pg.Pool | null = null;
let postgresJsClient: ReturnType<typeof postgres> | null = null;
let dbInstance: DbInstance | null = null;
let workerBoundDatabaseUrl: string | undefined;
let workerPoolAdapter: pg.Pool | null = null;

declare global {
  // eslint-disable-next-line no-var
  var __TORGIMA_WORKER_DATABASE_URL__: string | undefined;
}

function isCloudflareWorkerRuntime(): boolean {
  return process.env.TORGIMA_RUNTIME === "cloudflare";
}

/** Bind Worker c.env.DATABASE_URL — refreshes postgres-js client when URL changes. */
export function bindWorkerDatabaseUrl(url: string | undefined): void {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (!trimmed) return;
  if (workerBoundDatabaseUrl !== trimmed) {
    resetWorkerDbCache();
    workerBoundDatabaseUrl = trimmed;
    globalThis.__TORGIMA_WORKER_DATABASE_URL__ = trimmed;
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

function resolveWorkerPostgresSsl(connectionString: string): "require" | { rejectUnauthorized: boolean } {
  const sslConfig = resolvePgSsl(connectionString);
  if (!sslConfig) return "require";
  if (sslConfig === true) return "require";
  return sslConfig;
}

function createWorkerPostgresClient(connectionString: string): ReturnType<typeof postgres> {
  const workerUrl = normalizeWorkerDatabaseUrl(connectionString);
  return postgres(workerUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 12,
    prepare: false,
    ssl: resolveWorkerPostgresSsl(connectionString),
  });
}

/** Raw SQL for health/diagnostic probes — postgres-js on Workers, node-postgres elsewhere. */
export async function executeHealthSql<T extends Record<string, unknown> = Record<string, unknown>>(
  queryText: string,
  values?: unknown[],
): Promise<T[]> {
  const client = getPool();
  const result = values?.length
    ? await client.query<T>(queryText, values)
    : await client.query<T>(queryText);
  return result.rows as T[];
}

function createWorkerPoolAdapter(client: ReturnType<typeof postgres>): pg.Pool {
  const adapter = {
    query: async (
      queryText: string,
      values?: unknown[],
    ): Promise<pg.QueryResult<pg.QueryResultRow>> => {
      const rows = values?.length
        ? await client.unsafe(queryText, values as never[])
        : await client.unsafe(queryText);
      return {
        rows: rows as pg.QueryResultRow[],
        rowCount: rows.length,
        command: "",
        oid: 0,
        fields: [],
      };
    },
    end: async () => {
      await client.end({ timeout: 1 });
    },
    on: () => adapter,
  };
  return adapter as unknown as pg.Pool;
}

/** Clear cached clients when Worker env bindings change (e.g. DATABASE_URL secret added). */
export function resetWorkerDbCache(): void {
  if (postgresJsClient) {
    void postgresJsClient.end({ timeout: 1 }).catch(() => undefined);
  }
  postgresJsClient = null;
  dbInstance = null;
  poolInstance = null;
  workerPoolAdapter = null;
}

export function getPool(): pg.Pool {
  if (isVitestUnitStubDatabase()) {
    if (!poolInstance) {
      poolInstance = createVitestStubPool();
    }
    return poolInstance;
  }
  if (isCloudflareWorkerRuntime()) {
    if (!postgresJsClient || !workerPoolAdapter) {
      bindWorkerDatabaseUrl(process.env.DATABASE_URL);
      const connectionString = getConnectionString();
      postgresJsClient = createWorkerPostgresClient(connectionString);
      workerPoolAdapter = createWorkerPoolAdapter(postgresJsClient);
    }
    return workerPoolAdapter;
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
  if (isCloudflareWorkerRuntime()) {
    bindWorkerDatabaseUrl(process.env.DATABASE_URL);
    const connectionString = getConnectionString();
    if (dbInstance && workerBoundDatabaseUrl === connectionString) {
      return dbInstance;
    }

    if (postgresJsClient) {
      void postgresJsClient.end({ timeout: 1 }).catch(() => undefined);
    }
    postgresJsClient = createWorkerPostgresClient(connectionString);
    workerPoolAdapter = createWorkerPoolAdapter(postgresJsClient);
    dbInstance = drizzlePostgresJs(postgresJsClient, { schema }) as unknown as DbInstance;
    return dbInstance;
  }

  if (!dbInstance) {
    dbInstance = drizzleNodePg(getPool(), { schema });
  }
  return dbInstance;
}

/** Lazy pool — postgres-js adapter on Workers, node-postgres elsewhere. */
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
