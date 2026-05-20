#!/usr/bin/env node
/**
 * Bhudhi B1 — ad-hoc Anthropic call audit (grep inventory).
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../artifacts/api-server/src");

function rg(pattern) {
  try {
    const out = execSync(
      `rg -n "${pattern}" --glob "*.ts" --glob "!**/*.test.ts" "${apiSrc}"`,
      { encoding: "utf8" },
    );
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

const sdkHits = rg("new Anthropic|messages\\.create|createBhudhiMessage");
const bhudhiCoreImports = rg("from.*BhudhiCore");

console.log("=== BHUDHI B1 AUDIT ===\n");
console.log("Anthropic SDK / gateway (expect TriggerRouter only):");
for (const line of sdkHits) console.log(`  ${line}`);
console.log(`\nTotal SDK lines: ${sdkHits.length}`);

console.log("\nDirect BhudhiCore imports (expect TriggerRouter + BhudhiCore only):");
for (const line of bhudhiCoreImports) console.log(`  ${line}`);
console.log(`\nTotal: ${bhudhiCoreImports.length}`);

const governed = rg("routeBhudhiRequest|routeTrigger");
console.log(`\nGoverned call sites (routeBhudhiRequest|routeTrigger): ${governed.length} lines`);
