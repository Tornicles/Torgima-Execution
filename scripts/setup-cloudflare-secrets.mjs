#!/usr/bin/env node
/**
 * Securely prompt for Cloudflare Worker secrets and store via wrangler secret put.
 * Never writes secrets to disk or logs secret values.
 *
 * Prerequisites:
 *   CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID) in environment, or run: npx wrangler login
 *
 * Usage: pnpm cf:secrets:worker
 */

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerConfig = resolve(root, "artifacts/api-server/wrangler.toml");
const workerName = "torgima";

const WORKER_SECRETS = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "INTERNAL_AUTH_SECRET",
  "NOTIFICATION_UNSUBSCRIBE_SECRET",
];

/** Plaintext vars live in wrangler.toml [vars] — listed for operator reference only. */
const WORKER_PLAINTEXT_VARS = {
  NODE_ENV: "production",
  TORGIMA_RUNTIME: "cloudflare",
  APP_URL: "https://torgima.com",
  FRONTEND_URL: "https://torgima.com",
};

function runCapture(cmd, args, input) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    input,
    env: process.env,
    shell: process.platform === "win32",
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function checkWranglerAuth() {
  const { status, stderr, stdout } = runCapture("pnpm", [
    "exec",
    "wrangler",
    "whoami",
    "--config",
    workerConfig,
  ]);
  const output = `${stdout}\n${stderr}`;
  if (status === 0) return { ok: true };

  if (/not logged in|authentication|CLOUDFLARE_API_TOKEN|login/i.test(output)) {
    return {
      ok: false,
      message:
        "Wrangler is not authenticated. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, or run: npx wrangler login",
    };
  }
  return { ok: false, message: "Wrangler whoami failed. Check Cloudflare credentials." };
}

function promptLine(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function promptHidden(label) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(`${label} (input hidden, Enter to skip): `);

    if (!stdin.isTTY) {
      stdout.write("\n");
      resolve("");
      return;
    }

    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";

    const cleanup = () => {
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\n" || char === "\r" || char === "\u0004") {
          cleanup();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          cleanup();
          stdout.write("\n");
          reject(new Error("Cancelled"));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    stdin.on("data", onData);
  });
}

function storeSecret(name, value) {
  const { status, stderr, stdout } = runCapture(
    "pnpm",
    ["exec", "wrangler", "secret", "put", name, "--config", workerConfig],
    value,
  );
  const output = `${stdout}\n${stderr}`;
  if (status === 0) return { ok: true };
  if (/success|uploaded|created/i.test(output)) return { ok: true };
  return { ok: false, reason: output.trim().slice(0, 300) };
}

async function main() {
  if (!existsSync(workerConfig)) {
    console.error(`[cf:secrets] Worker config not found: ${workerConfig}`);
    process.exit(1);
  }

  console.log(`[cf:secrets] Target Worker: ${workerName}`);
  console.log(`[cf:secrets] Config: artifacts/api-server/wrangler.toml`);
  console.log("[cf:secrets] Secrets are never written to disk or echoed.");
  console.log("[cf:secrets] DATABASE_URL: use Supabase transaction pooler (*.pooler.supabase.com:6543).\n");

  console.log("[cf:secrets] Plaintext vars (set in wrangler.toml [vars], not via secret put):");
  for (const [key, value] of Object.entries(WORKER_PLAINTEXT_VARS)) {
    console.log(`  ${key}=${value}`);
  }
  console.log("");

  const auth = checkWranglerAuth();
  if (!auth.ok) {
    console.error(`[cf:secrets] ${auth.message}`);
    process.exit(1);
  }
  console.log("[cf:secrets] Wrangler authentication OK.\n");

  const mode = await promptLine(
    "Store all secrets now? [A]ll prompts / [S]kip and exit / single key name: ",
  );
  const trimmed = mode.trim();

  if (/^s$/i.test(trimmed) || trimmed === "") {
    console.log("[cf:secrets] Exited without changes.");
    process.exit(0);
  }

  const keysToStore =
    /^a$/i.test(trimmed) || /^all$/i.test(trimmed)
      ? WORKER_SECRETS
      : WORKER_SECRETS.includes(trimmed)
        ? [trimmed]
        : null;

  if (!keysToStore) {
    console.error(
      `[cf:secrets] Unknown selection "${trimmed}". Use A for all, or one of: ${WORKER_SECRETS.join(", ")}`,
    );
    process.exit(1);
  }

  let stored = 0;
  let skipped = 0;
  let failed = 0;

  for (const name of keysToStore) {
    let value;
    try {
      value = await promptHidden(name);
    } catch {
      console.log("[cf:secrets] Aborted.");
      process.exit(130);
    }

    if (!value.trim()) {
      console.log(`${name}: skipped`);
      skipped++;
      continue;
    }

    const result = storeSecret(name, value.trim());
    if (result.ok) {
      console.log(`${name}: stored`);
      stored++;
    } else {
      console.error(`${name}: failed (${result.reason ?? "wrangler error"})`);
      failed++;
    }
  }

  console.log(`\n[cf:secrets] Done — stored: ${stored}, skipped: ${skipped}, failed: ${failed}`);
  console.log("[cf:secrets] Verify (no values shown):");
  console.log("  curl https://api.torgima.com/api/debug/cloudflare-env");
  console.log("[cf:secrets] Redeploy if needed: pnpm run deploy:cloudflare:api");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[cf:secrets] Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
