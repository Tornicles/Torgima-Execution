#!/usr/bin/env node
/**
 * DOC 36 — reset dedicated loop test user before a full-loop run.
 * Usage: pnpm -F @workspace/scripts exec tsx ./doc36-reset-test-user.ts
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

async function main() {
  const helper = path.join(root, "artifacts/api-server/src/tests/helpers/doc36-reset.ts");
  if (!existsSync(helper)) {
    throw new Error("doc36-reset helper missing");
  }
  const { resetDoc36TestUser, doc36HasActiveBlueprint, DOC36_TEST_EMAIL } = await import(
    pathToFileURL(helper).href
  );
  const { userId } = await resetDoc36TestUser();
  const hasBp = await doc36HasActiveBlueprint(userId);
  process.stdout.write(`DOC36 reset complete for ${DOC36_TEST_EMAIL}\n`);
  process.stdout.write(`userId=${userId} hasActiveBlueprint=${hasBp}\n`);
  if (hasBp) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
