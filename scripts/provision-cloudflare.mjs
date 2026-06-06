#!/usr/bin/env node
/**
 * Provision Cloudflare resources for Torgima and deploy Worker + Pages.
 * Requires: wrangler authenticated (`wrangler login`) or CLOUDFLARE_API_TOKEN env.
 * Loads DATABASE_URL from .env.production.local when present (gitignored).
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wranglerPath = resolve(root, "artifacts/api-server/wrangler.toml");
const envLocalPath = resolve(root, ".env.production.local");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
  return result;
}

function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Command failed: ${cmd}`);
  }
  return result.stdout.trim();
}

function patchWranglerHyperdriveId(id) {
  const text = readFileSync(wranglerPath, "utf8");
  const updated = text.replace(
    /"id": "REPLACE_WITH_HYPERDRIVE_ID"/,
    `"id": "${id}"`,
  );
  if (updated === text) {
    console.log("[provision] Hyperdrive ID already set in wrangler.toml");
    return;
  }
  writeFileSync(wranglerPath, updated, "utf8");
  console.log(`[provision] Updated wrangler.toml Hyperdrive id → ${id}`);
}

function ensureHyperdrive() {
  const existing = runCapture("pnpm", ["exec", "wrangler", "hyperdrive", "list"]);
  const match = existing.match(/torgima-supabase[\s\S]*?([a-f0-9]{32})/i);
  if (match) {
    patchWranglerHyperdriveId(match[1]);
    return match[1];
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes("[PASSWORD]")) {
    console.warn(
      "[provision] DATABASE_URL missing — skipping Hyperdrive create; Worker will use DATABASE_URL secret",
    );
    return null;
  }

  const out = runCapture("pnpm", [
    "exec",
    "wrangler",
    "hyperdrive",
    "create",
    "torgima-supabase",
    `--connection-string=${dbUrl}`,
    "--caching-disabled",
  ]);
  const idMatch = out.match(/id[:\s]+([a-f0-9]{32})/i);
  if (!idMatch) {
    throw new Error("[provision] Could not parse Hyperdrive id from wrangler output");
  }
  patchWranglerHyperdriveId(idMatch[1]);
  return idMatch[1];
}

function setWorkerSecrets() {
  const secrets = [
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["APP_URL", process.env.FRONTEND_URL ?? "https://torgima.com"],
    ["INTERNAL_API_SECRET", process.env.INTERNAL_AUTH_SECRET],
    ["NEXTAUTH_SECRET", process.env.INTERNAL_AUTH_SECRET],
    ["SESSION_SECRET", process.env.INTERNAL_AUTH_SECRET],
  ];

  for (const [name, value] of secrets) {
    if (!value) {
      console.warn(`[provision] Skipping secret ${name} (not in env)`);
      continue;
    }
    run("pnpm", [
      "exec",
      "wrangler",
      "secret",
      "put",
      name,
      "--config",
      "artifacts/api-server/wrangler.toml",
    ], {
      input: value,
      stdio: ["pipe", "inherit", "inherit"],
    });
  }
}

async function main() {
  loadEnvFile(envLocalPath);

  run("pnpm", ["exec", "wrangler", "whoami"]);

  console.log("[provision] Ensuring Hyperdrive…");
  ensureHyperdrive();

  console.log("[provision] Ensuring Queues…");
  run("pnpm", ["run", "ensure:cloudflare:queues"]);

  console.log("[provision] Building monorepo…");
  run("pnpm", ["run", "build"]);

  console.log("[provision] Deploying API Worker…");
  run("pnpm", ["run", "deploy:cloudflare:api"]);

  console.log("[provision] Setting Worker secrets…");
  setWorkerSecrets();

  console.log("[provision] Building + deploying Pages…");
  process.env.VITE_API_BASE_URL ??= "https://api.torgima.com";
  run("pnpm", ["run", "build:cloudflare:pages"]);
  run("pnpm", ["run", "deploy:cloudflare:pages"]);

  console.log("[provision] Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
