#!/usr/bin/env node
/**
 * Verify 25-sequence definitions, tier gates, and feature gating (no DB required).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sequencesPath = join(
  root,
  "artifacts/api-server/src/types/sequences.ts",
);
const featureGatePath = join(
  root,
  "artifacts/api-server/src/lib/featureGate.ts",
);
const growthGatePath = join(
  root,
  "artifacts/api-server/src/engines/growth/growthGate.ts",
);
const ultimateGatePath = join(
  root,
  "artifacts/api-server/src/engines/ultimate/ultimateGate.ts",
);

function read(path) {
  return readFileSync(path, "utf8");
}

console.log("Verifying 25-Sequence System\n");

const seqSrc = read(sequencesPath);
const seqMatches = [...seqSrc.matchAll(/number:\s*(\d+)/g)];
const uniqueNumbers = new Set(seqMatches.map((m) => Number(m[1])));
console.log(`✓ Sequence definitions file present`);
console.log(`  - Distinct sequence numbers found: ${uniqueNumbers.size}`);
if (uniqueNumbers.size < 25) {
  console.error("✗ Expected at least 25 sequence numbers in sequences.ts");
  process.exit(1);
}

const starterCount = (seqSrc.match(/tier:\s*["']Starter["']/g) ?? []).length;
const growthCount = (seqSrc.match(/tier:\s*["']Growth["']/g) ?? []).length;
const ultimateCount = (seqSrc.match(/tier:\s*["']Ultimate["']/g) ?? []).length;
console.log(`  - Starter-tier refs: ${starterCount}`);
console.log(`  - Growth-tier refs: ${growthCount}`);
console.log(`  - Ultimate-tier refs: ${ultimateCount}`);

const fg = read(featureGatePath);
const featureKeys = [...fg.matchAll(/^\s+(\w+):\s*\{/gm)].map((m) => m[1]);
console.log(`\n✓ Feature gates: ${featureKeys.length} features defined`);
const required = [
  "interrogation",
  "knowledge_cards",
  "predictions",
  "scene_analysis",
  "emergency_orders",
];
for (const key of required) {
  if (!featureKeys.includes(key)) {
    console.error(`✗ Missing feature gate: ${key}`);
    process.exit(1);
  }
  console.log(`  - ${key}: ok`);
}

const growthGate = read(growthGatePath);
const ultimateGate = read(ultimateGatePath);
if (!growthGate.includes("GROWTH_SEQUENCE_NUMBER = 24")) {
  console.error("✗ Growth sequence number must be 24");
  process.exit(1);
}
if (!ultimateGate.includes("ULTIMATE_SEQUENCE_NUMBER = 25")) {
  console.error("✗ Ultimate sequence number must be 25");
  process.exit(1);
}
console.log("\n✓ Growth gate: sequence 24");
console.log("✓ Ultimate gate: sequence 25");

const migrations = [
  "scripts/migrations/manual-20260530-sequence-tracking-foundation.sql",
  "scripts/migrations/manual-20260531-growth-features.sql",
  "scripts/migrations/manual-20260601-ultimate-features.sql",
];
console.log("\n✓ Migration files:");
for (const rel of migrations) {
  try {
    read(join(root, rel));
    console.log(`  - ${rel}: present`);
  } catch {
    console.error(`  - ${rel}: MISSING`);
    process.exit(1);
  }
}

console.log("\n✅ 25-Sequence static verification complete\n");
