import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import { resolvePgSsl } from "./src/pg-ssl";

dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: "../../.env" });
dotenv.config({ path: "../../artifacts/api-server/.env" });

const connectionUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionUrl) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

function parsePgUrl(connectionString: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  const normalized = connectionString
    .replace(/^postgresql:\/\//i, "http://")
    .replace(/^postgres:\/\//i, "http://");
  const u = new URL(normalized);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "").split("?")[0] || "postgres",
  };
}

/** Match schema modules (explicit list is reliable for drizzle-kit on Windows). */
export default defineConfig({
  schema: ["./src/schema/enums.ts", "./src/schema/tables.ts"],
  dialect: "postgresql",
  dbCredentials: {
    ...parsePgUrl(connectionUrl),
    ssl: resolvePgSsl(connectionUrl),
  },
});
