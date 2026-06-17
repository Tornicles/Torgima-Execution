#!/usr/bin/env node
import { pool } from "@workspace/db";

async function main() {
  const count = await pool.query<{ c: string }>(
    "select count(*)::text as c from information_schema.columns where table_name = 'blueprints'",
  );
  console.log({ blueprint_column_count: Number(count.rows[0]?.c ?? 0) });
  const r = await pool.query<{ column_name: string }>(
    "select column_name from information_schema.columns where table_name = 'blueprints' and column_name in ('erector_baseline_state','execution_state','dashboard_mode') order by column_name",
  );
  console.log(r.rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

