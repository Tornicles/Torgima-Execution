import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");

describe("Migration idempotency precheck", () => {
  it("passes for all Drizzle journal migrations", () => {
    const output = execFileSync("node", ["scripts/check-migrations-idempotent.mjs"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(output).toMatch(/precheck OK/i);
  });

  it("0013 has no unsafe top-level CREATE TYPE statements", () => {
    const sql = readFileSync(join(root, "migrations/0013_bhudhi_upgrade.sql"), "utf8");
    expect(sql.match(/^CREATE TYPE "public"\./gm) ?? []).toHaveLength(0);
    expect(sql.match(/WHEN duplicate_object THEN NULL/g) ?? []).toHaveLength(52);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "academy_chapters"/);
    expect(sql).toMatch(/pg_constraint WHERE conname = 'academy_chapters_course_id_academy_courses_id_fk'/);
  });
});
