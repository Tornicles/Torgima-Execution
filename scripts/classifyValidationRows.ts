#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

dotenv.config({ path: path.join(REPO_ROOT, ".env.local") });
dotenv.config({ path: path.join(REPO_ROOT, ".env") });
dotenv.config({ path: path.join(REPO_ROOT, "artifacts/api-server/.env") });

const { db, pool, validations } = await import("@workspace/db");

type ValidationKind = "intelligence" | "erector" | "legacy" | "readiness" | "path_selection" | "unknown";

function classifyPayload(row: typeof validations.$inferSelect): ValidationKind {
  const payload = row.intelligence_payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "legacy";

  const obj = payload as Record<string, unknown>;
  if (obj["erector"] === true || obj["archetypeResolution"] || row.reality_score != null) return "erector";
  if (obj["verdict"] && obj["paths"]) return "intelligence";
  if (row.selected_path || row.selected_path_type) return "path_selection";
  if (row.readiness) return "readiness";
  return "unknown";
}

async function main(): Promise<void> {
  const rows = await db
    .select()
    .from(validations)
    .where(eq(validations.validation_kind, "unknown"));

  const counts: Record<ValidationKind, number> = {
    intelligence: 0,
    erector: 0,
    legacy: 0,
    readiness: 0,
    path_selection: 0,
    unknown: 0,
  };

  console.log(`Classifying ${rows.length} unclassified validation rows...`);

  for (const row of rows) {
    const kind = classifyPayload(row);
    await db
      .update(validations)
      .set({ validation_kind: kind })
      .where(eq(validations.id, row.id));
    counts[kind]++;
  }

  console.log("Classification complete:", counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => null);
  });
