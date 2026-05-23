/**
 * Boot preflight must not require Erector-only columns (magic link / auth must work during migration catch-up).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const hasTable = vi.fn();
const hasColumn = vi.fn();

vi.mock("@workspace/db", () => ({
  pool: { query: vi.fn() },
}));

vi.mock("../../../lib/verifySchema.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../lib/verifySchema.js")>();
  return mod;
});

describe("verifySchema boot vs extended preflight", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("runRuntimeSchemaPreflight does not import erector-only column names in BOOT_CRITICAL", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const text = fs.readFileSync(path.resolve(dir, "../../../lib/verifySchema.ts"), "utf8");
    const bootBlock = text.slice(text.indexOf("BOOT_CRITICAL_COLUMNS"), text.indexOf("EXTENDED_SCHEMA_COLUMNS"));
    expect(bootBlock).not.toMatch(/table:\s*"blueprints",\s*column:\s*"blueprint_tier"/);
    expect(bootBlock).not.toContain("erector_validation_stage");
    expect(bootBlock).toContain("token_hash");
  });

  it("EXTENDED_SCHEMA_COLUMNS lists erector blueprint fields", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const text = fs.readFileSync(path.resolve(dir, "../../../lib/verifySchema.ts"), "utf8");
    expect(text).toContain("EXTENDED_SCHEMA_COLUMNS");
    expect(text).toContain("blueprint_tier");
    expect(text).toContain("checkExtendedSchemaHealth");
  });
});
