/**
 * DB connectivity check using the same pool wiring as the API (via @workspace/db).
 * Usage: `cd artifacts/api-server && pnpm exec tsx scripts/db-connection-smoke.mts`
 * Loads repo-root `.env.local` into `process.env` before importing `@workspace/db`.
 */
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRootEnvLocal(): void {
  const envPath = resolve(__dirname, "..", "..", "..", ".env.local");
  if (!existsSync(envPath)) return;
  const txt = readFileSync(envPath, "utf8");
  for (let line of txt.split("\n")) {
    line = line.replace(/\r$/, "");
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

loadRootEnvLocal();

const url = process.env.DATABASE_URL ?? "";
console.log("URL prefix:", url ? `${url.substring(0, 60)}…` : "(empty)");
console.log("Has sslmode:", url.includes("sslmode"));

async function test(): Promise<void> {
  if (!url) {
    console.error(
      "DATABASE_URL is empty. Set env or add DATABASE_URL to repo-root .env.local.",
    );
    process.exitCode = 1;
    return;
  }

  const { pool } = await import("@workspace/db");

  try {
    const r = await pool.query<{ db: string; usr: string }>(
      `SELECT current_database() AS db, current_user AS usr`,
    );
    console.log("SUCCESS:", r.rows);
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { code?: string };
    console.error("FAILED:", e.message);
    console.error("Code:", e.code);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => null);
  }
}

void test();
