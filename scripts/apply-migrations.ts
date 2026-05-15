#!/usr/bin/env node
/**
 * Apply all scripts/migrations/*.sql to DATABASE_URL (Supabase / Railway Postgres).
 * Usage: pnpm -F @workspace/scripts apply-migrations
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

dotenv.config({ path: path.join(REPO_ROOT, ".env.local") });
dotenv.config({ path: path.join(REPO_ROOT, ".env") });
dotenv.config({ path: path.join(REPO_ROOT, "artifacts/api-server/.env") });

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL or DIRECT_URL");
  process.exit(1);
}

const dir = path.join(REPO_ROOT, "scripts/migrations");
if (!existsSync(dir)) {
  console.error("Missing scripts/migrations");
  process.exit(1);
}

process.env.DATABASE_URL = url;
const { pool } = await import("@workspace/db");

function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = "";
  let inDollar = false;
  for (const line of sql.split("\n")) {
    if (line.trim().startsWith("--")) continue;
    if (line.includes("DO $$")) inDollar = true;
    buf += `${line}\n`;
    if (inDollar && line.trim().endsWith("$$;")) {
      statements.push(buf.trim());
      buf = "";
      inDollar = false;
      continue;
    }
    if (!inDollar && line.trim().endsWith(";")) {
      statements.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) statements.push(buf.trim());
  return statements.filter(Boolean);
}

async function main() {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let ok = 0;
  let fail = 0;

  for (const file of files) {
    const sql = readFileSync(path.join(dir, file), "utf8");
    console.log(`\n── ${file} ──`);
    for (const stmt of splitStatements(sql)) {
      try {
        await pool.query(stmt);
        ok++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/already exists|duplicate_object/i.test(msg)) {
          ok++;
          continue;
        }
        fail++;
        console.error(`  FAIL: ${msg.slice(0, 120)}`);
      }
    }
  }

  const verify = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'validations' AND column_name IN ('readiness','launch_blocked','intelligence_payload')
  `);
  console.log(`\nValidations columns found: ${verify.rows.map((r) => r.column_name).join(", ")}`);
  console.log(`Statements: ${ok} ok, ${fail} failed`);
  await pool.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
