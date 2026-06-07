#!/usr/bin/env node
/**
 * CI precheck: block unsafe migration patterns that break partially migrated production DBs.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const migrationsDir = join(root, "migrations");
const journalPath = join(migrationsDir, "meta", "_journal.json");

const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const journalFiles = journal.entries.map((entry) => `${entry.tag}.sql`);

const issues = [];

function checkBhudhiUpgrade(relPath, content) {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (/^CREATE TYPE "public"\./.test(line)) {
      issues.push(`${relPath}:${lineNo} unsafe top-level CREATE TYPE`);
    }
    if (/^CREATE TABLE "/.test(line) && !/^CREATE TABLE IF NOT EXISTS "/.test(line)) {
      issues.push(`${relPath}:${lineNo} CREATE TABLE without IF NOT EXISTS`);
    }
    if (/^CREATE UNIQUE INDEX "/.test(line) && !/IF NOT EXISTS/.test(line)) {
      issues.push(`${relPath}:${lineNo} CREATE UNIQUE INDEX without IF NOT EXISTS`);
    }
    if (/^CREATE INDEX "/.test(line) && !/IF NOT EXISTS/.test(line)) {
      issues.push(`${relPath}:${lineNo} CREATE INDEX without IF NOT EXISTS`);
    }
    if (/^ALTER TABLE .+ ADD CONSTRAINT "/.test(line)) {
      issues.push(`${relPath}:${lineNo} unguarded ADD CONSTRAINT (must use pg_constraint DO block)`);
    }
  }

  const unsafeEnumCount = (content.match(/^CREATE TYPE "public"\./gm) ?? []).length;
  const safeEnumCount = (content.match(/WHEN duplicate_object THEN NULL/g) ?? []).length;
  if (unsafeEnumCount > 0) {
    issues.push(`${relPath}: ${unsafeEnumCount} unsafe top-level CREATE TYPE statement(s) remain`);
  }
  if (safeEnumCount < 52) {
    issues.push(`${relPath}: expected 52 duplicate_object enum handlers, found ${safeEnumCount}`);
  }
}

function checkJournalFile(relPath, content) {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    if (/^CREATE TYPE "public"\./.test(line)) {
      issues.push(`${relPath}:${lineNo} unsafe top-level CREATE TYPE`);
    }
  }
}

for (const fileName of journalFiles) {
  const rel = join("migrations", fileName);
  const content = readFileSync(join(migrationsDir, fileName), "utf8");
  checkJournalFile(rel, content);
  if (fileName === "0013_bhudhi_upgrade.sql") {
    checkBhudhiUpgrade(rel, content);
  }
}

if (issues.length > 0) {
  console.error("Migration idempotency precheck FAILED:\n");
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

console.log(
  `Migration idempotency precheck OK (${journalFiles.length} journal migrations; 0013 fully guarded)`,
);
