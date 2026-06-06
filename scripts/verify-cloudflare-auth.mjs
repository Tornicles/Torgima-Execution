#!/usr/bin/env node
/**
 * Verify Cloudflare API token auth before deploy.
 * Requires CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID for account-scoped ops).
 * Never reads passwords — token-only auth.
 */

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`[cf:verify] ${message}`);
  process.exit(1);
}

const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();

if (!token) {
  fail(
    "Missing CLOUDFLARE_API_TOKEN.\n" +
      "  PowerShell: $env:CLOUDFLARE_API_TOKEN = \"<token>\"\n" +
      "  Bash:       export CLOUDFLARE_API_TOKEN=\"<token>\"\n" +
      "  See .env.cloudflare.example (copy to .env.cloudflare.local — gitignored).",
  );
}

if (!accountId) {
  console.warn(
    "[cf:verify] CLOUDFLARE_ACCOUNT_ID is not set. Some commands may fail; set it from the Cloudflare dashboard.",
  );
}

const whoami = spawnSync("pnpm", ["exec", "wrangler", "whoami"], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
  env: process.env,
});

const output = `${whoami.stdout ?? ""}${whoami.stderr ?? ""}`;
process.stdout.write(whoami.stdout ?? "");
process.stderr.write(whoami.stderr ?? "");

if (whoami.status !== 0 || /not authenticated/i.test(output)) {
  fail("wrangler whoami failed — check that CLOUDFLARE_API_TOKEN is valid.");
}

console.log("[cf:verify] Cloudflare API token is valid.");
