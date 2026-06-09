#!/usr/bin/env node
/**
 * Local Node API start — resolves dist path from monorepo root or api-server package root.
 */
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  path.join(repoRoot, "artifacts/api-server/dist/index.mjs"),
  path.join(process.cwd(), "artifacts/api-server/dist/index.mjs"),
  path.join(process.cwd(), "dist/index.mjs"),
];

const entry = candidates.find((p) => existsSync(p));
if (!entry) {
  console.error("[start-api] Could not find index.mjs. Tried:\n", candidates.join("\n"));
  process.exit(1);
}

console.log(`[start-api] node ${entry}`);
const child = spawn(process.execPath, ["--enable-source-maps", entry], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 1));
