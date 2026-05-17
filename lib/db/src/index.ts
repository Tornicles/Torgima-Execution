import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { resolvePgSsl, stripSslModeFromConnectionString } from "./pg-ssl";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("[DB] DATABASE_URL is not set. Cannot start.");
}

export { resolvePgSsl, stripSslModeFromConnectionString };

const poolConnectionString = stripSslModeFromConnectionString(connectionString);

export const pool = new Pool({
  connectionString: poolConnectionString,
  ssl: resolvePgSsl(connectionString),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error("[DB] Pool error:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
