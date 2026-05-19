import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: "../../.env" });
dotenv.config({ path: "../../artifacts/api-server/.env" });

const connectionUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionUrl) {
  throw new Error("DATABASE_URL or DIRECT_URL must be set before running drizzle-kit");
}

/** Match schema modules (explicit list is reliable for drizzle-kit on Windows). */
export default defineConfig({
  schema: ["./src/schema/enums.ts", "./src/schema/tables.ts"],
  out: "../../migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionUrl,
  },
  verbose: true,
  strict: true,
});
