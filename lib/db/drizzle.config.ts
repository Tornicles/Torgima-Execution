import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import { resolvePgSsl, stripSslModeFromConnectionString } from "./src/pg-ssl";

dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: "../../.env" });
dotenv.config({ path: "../../artifacts/api-server/.env" });

const connectionUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionUrl) {
  throw new Error("DATABASE_URL or DIRECT_URL must be set before running drizzle-kit");
}

function resolveDrizzleConnectionUrl(url: string): string {
  const ssl = resolvePgSsl(url);
  const stripped = stripSslModeFromConnectionString(url);
  if (!ssl || ssl === true) return stripped;

  try {
    const normalized = stripped.replace(/^postgresql:/i, "postgres:");
    const parsed = new URL(normalized);
    parsed.searchParams.set("sslmode", "no-verify");
    return parsed.toString().replace(/^postgres:/i, "postgresql:");
  } catch {
    const separator = stripped.includes("?") ? "&" : "?";
    return `${stripped}${separator}sslmode=no-verify`;
  }
}

const drizzleConnectionUrl = resolveDrizzleConnectionUrl(connectionUrl);

/** Match schema modules (explicit list is reliable for drizzle-kit on Windows). */
export default defineConfig({
  schema: ["./src/schema/enums.ts", "./src/schema/tables.ts"],
  out: "../../migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: drizzleConnectionUrl,
  },
  verbose: true,
  strict: true,
});
