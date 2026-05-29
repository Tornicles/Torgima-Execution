#!/usr/bin/env node
/**
 * TORGIMA Complete System Diagnostic (DOC: TORGIMA_COMPLETE_DIAGNOSTIC_PROMPT.docx)
 *
 * Run from repo root:
 *   pnpm diagnostic:complete
 *   pnpm diagnostic:complete -- --probe-db
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

dotenv.config({ path: join(repoRoot, ".env.local") });
dotenv.config({ path: join(repoRoot, ".env") });
dotenv.config({ path: join(repoRoot, "artifacts/api-server/.env") });

const probeDb = process.argv.includes("--probe-db");
if (probeDb) {
  process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
}

const {
  runCompleteSystemDiagnostic,
  formatDiagnosticReportMarkdown,
} = await import("../../artifacts/api-server/src/diagnostics/completeSystemDiagnostic.js");

async function main() {
  const report = await runCompleteSystemDiagnostic({ probeDatabase: probeDb });
  const markdown = formatDiagnosticReportMarkdown(report);
  const outPath = join(repoRoot, "TORGIMA_COMPLETE_DIAGNOSTIC_REPORT.md");
  writeFileSync(outPath, markdown, "utf8");

  console.log(markdown);
  console.log(`\n---\nReport written to ${outPath}`);
  console.log(
    `Checks: ${report.rawChecks.filter((c) => c.passed).length}/${report.rawChecks.length} passed`,
  );

  const failed = report.rawChecks.filter((c) => !c.passed);
  const envOnlyFailures = failed.every((c) => c.section === "10");
  if (failed.length > 0 && !envOnlyFailures) {
    process.exitCode = 1;
  } else if (envOnlyFailures) {
    console.error(
      "\nNote: Only deployment env vars failed (expected in local dev without .env).",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
