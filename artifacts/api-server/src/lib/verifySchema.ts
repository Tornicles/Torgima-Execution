import { pool } from "@workspace/db";

/** Columns required for POST /api/onboarding/goal and launch flow. */
const REQUIRED_COLUMNS: Array<{ table: string; column: string }> = [
  { table: "validations", column: "intelligence_payload" },
  { table: "validations", column: "launch_blocked" },
  { table: "validations", column: "readiness" },
  { table: "validations", column: "blueprint_contract" },
  { table: "validations", column: "tier" },
  { table: "blueprints", column: "tier" },
  { table: "blueprints", column: "mode" },
  { table: "blueprints", column: "intelligence_depth" },
  { table: "blueprints", column: "selection_confirmed_at" },
  { table: "blueprints", column: "blueprint_config" },
  { table: "blueprints", column: "validation_id" },
];

const REQUIRED_TABLES = [
  "eis_rate_limits",
  "eis_call_logs",
  "validation_event_logs",
  "validation_memory",
];

export type SchemaVerifyResult = {
  ok: boolean;
  missingColumns: Array<{ table: string; column: string }>;
  missingTables: string[];
};

export async function verifyOnboardingSchema(): Promise<SchemaVerifyResult> {
  const missingColumns: Array<{ table: string; column: string }> = [];
  const missingTables: string[] = [];

  for (const { table, column } of REQUIRED_COLUMNS) {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column],
    );
    if ((r.rowCount ?? 0) === 0) missingColumns.push({ table, column });
  }

  for (const table of REQUIRED_TABLES) {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    if ((r.rowCount ?? 0) === 0) missingTables.push(table);
  }

  return {
    ok: missingColumns.length === 0 && missingTables.length === 0,
    missingColumns,
    missingTables,
  };
}
