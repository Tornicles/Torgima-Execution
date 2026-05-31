#!/usr/bin/env node
/**
 * Run Supabase/Postgres healing diagnostics and optional auto-repair.
 * Run: pnpm -F @workspace/scripts heal:db
 * Optional: HEAL_AUTO_REPAIR=true to dispatch stuck events + task generation for empty blueprints
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { pool } from "@workspace/db";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(repoRoot, ".env.local") });
dotenv.config({ path: join(repoRoot, ".env") });

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sqlPath = join(repoRoot, "scripts/supabase-healing-queries.sql");
const raw = readFileSync(sqlPath, "utf8");

const statements = raw
  .split(/\\echo\s+'[^']+'/g)
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && s.toLowerCase().startsWith("select"));

async function runDiagnostics(): Promise<void> {
  console.log("=== TORGIMA DB HEALING DIAGNOSTICS ===\n");
  for (const stmt of statements) {
    const label = stmt.match(/FROM\s+(\w+)/i)?.[1] ?? "query";
    console.log(`--- ${label} ---`);
    try {
      const res = await pool.query(stmt);
      if (res.rows.length === 0) {
        console.log("(no rows)\n");
      } else {
        console.table(res.rows.slice(0, 15));
        if (res.rows.length > 15) console.log(`… ${res.rows.length - 15} more rows\n`);
      }
    } catch (err) {
      console.error("Query failed:", err instanceof Error ? err.message : err, "\n");
    }
  }
}

async function autoRepair(): Promise<void> {
  if (process.env.HEAL_AUTO_REPAIR !== "true") return;

  const apiSrc = join(repoRoot, "artifacts/api-server/src");
  const { dispatchPendingEvents } = await import(
    pathToFileURL(join(apiSrc, "services/EventDispatcher.js")).href
  );
  const { writeEvent, EVENT_TYPES } = await import(
    pathToFileURL(join(apiSrc, "services/EventService.js")).href
  );

  const dispatched = await dispatchPendingEvents();
  console.log(`\n[HEAL] Dispatched ${dispatched} pending events`);

  const empty = await pool.query<{ id: string; user_id: string }>(`
    SELECT b.id, b.user_id
    FROM blueprints b
    WHERE b.active = true AND b.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.blueprint_id = b.id
          AND o.status IN ('pending', 'active', 'needs_feedback')
      )
    LIMIT 10
  `);

  for (const row of empty.rows) {
    await writeEvent({
      eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
      entityType: "blueprint",
      entityId: row.id,
      userId: row.user_id,
      blueprintId: row.id,
      payload: { trigger: "healing_empty_queue" },
      idempotencyKey: `heal:${row.id}:${Date.now()}`,
    });
    console.log(`[HEAL] Queued task generation for blueprint ${row.id}`);
  }
}

try {
  await runDiagnostics();
  await autoRepair();
  console.log("\nDone. Set HEAL_AUTO_REPAIR=true to dispatch repairs.");
} finally {
  await pool.end();
}
