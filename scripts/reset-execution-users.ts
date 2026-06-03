#!/usr/bin/env node
/**
 * Reset execution state for known users so they can enter a new goal flow.
 *
 * Usage:
 *   RESET_USER_EMAILS=you@example.com,other@example.com pnpm reset:users
 *   RESET_ALL_DEV_USERS=true pnpm reset:users   # all users except ADMIN_EMAIL
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const helper = path.join(root, "artifacts/api-server/src/tests/helpers/executionStateReset.ts");
  const mod = await import(pathToFileURL(helper).href);

  if (process.env.RESET_ALL_DEV_USERS === "true") {
    const count = await mod.resetAllNonAdminUsers();
    console.log(`Reset execution state for ${count} users (admin excluded).`);
    return;
  }

  const emails = await mod.listKnownUserEmails();
  if (emails.length === 0) {
    console.error("Set RESET_USER_EMAILS=email1@x.com,email2@y.com or RESET_ALL_DEV_USERS=true");
    process.exit(1);
  }

  const { results } = await mod.resetUsersByEmail(emails);
  for (const r of results) {
    if (r.ok) {
      console.log(`OK  ${r.email} (${r.userId})`);
    } else {
      console.log(`FAIL ${r.email}: ${r.error ?? "unknown"}`);
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
