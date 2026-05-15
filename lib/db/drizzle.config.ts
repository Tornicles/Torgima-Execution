import { defineConfig } from "drizzle-kit";
import { resolvePgSsl } from "./src/pg-ssl";

if (!process.env.DATABASE_URL) {
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

const url = process.env.DATABASE_URL;

/** Match schema modules (explicit list is reliable for drizzle-kit on Windows). */
export default defineConfig({
  schema: ["./src/schema/enums.ts", "./src/schema/tables.ts"],
  dialect: "postgresql",
  dbCredentials: {
    ...parsePgUrl(url),
    ssl: resolvePgSsl(url),
  },
});
