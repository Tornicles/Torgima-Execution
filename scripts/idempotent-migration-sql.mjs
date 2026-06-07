#!/usr/bin/env node
/**
 * Make Drizzle SQL migration files safe to rerun on partially migrated production DBs.
 * Usage: node scripts/idempotent-migration-sql.mjs [file.sql ...]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function splitStatements(sql) {
  return sql
    .split(/--> statement-breakpoint\r?\n?/)
    .map((part) => part.replace(/\s*--> statement-breakpoint\s*$/, "").trim())
    .filter(Boolean);
}

function joinStatements(statements) {
  return statements.map((s) => `${s}\n--> statement-breakpoint`).join("\n");
}

function wrapEnum(createTypeSql) {
  const body = createTypeSql.replace(/;\s*$/, "");
  return `DO $$ BEGIN
  ${body};
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;`;
}

function wrapConstraint(alterSql, constraintName) {
  const body = alterSql.replace(/;\s*$/, "");
  return `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${constraintName}') THEN
    ${body};
  END IF;
END $$;`;
}

function transformStatement(raw) {
  let s = raw.trim();

  if (!s) return s;

  // Unsafe top-level enum → wrap
  if (/^CREATE TYPE "public"\./.test(s)) {
    return wrapEnum(s);
  }

  // Strip accidental duplicate unsafe enum lines inside an existing DO block
  if (/DO \$\$ BEGIN/.test(s) && /CREATE TYPE "public"\./.test(s)) {
    const lines = s.split("\n");
    const hasWrapper = lines.some((line) => /DO \$\$ BEGIN/.test(line));
    if (hasWrapper) {
      s = lines.filter((line) => !/^CREATE TYPE "public"\./.test(line.trim())).join("\n").trim();
    }
  }

  // Already idempotent enum wrapper
  if (/^DO \$\$ BEGIN[\s\S]*CREATE TYPE "public"\./.test(s) && /duplicate_object/.test(s)) {
    return s;
  }

  // Already idempotent constraint wrapper
  if (/^DO \$\$ BEGIN[\s\S]*pg_constraint[\s\S]*END \$\$;?$/i.test(s)) {
    return s;
  }

  if (/^CREATE TABLE "/.test(s) && !/^CREATE TABLE IF NOT EXISTS "/.test(s)) {
    s = s.replace(/^CREATE TABLE "/, 'CREATE TABLE IF NOT EXISTS "');
  }

  if (/^CREATE UNIQUE INDEX "/.test(s) && !/IF NOT EXISTS/.test(s)) {
    s = s.replace(/^CREATE UNIQUE INDEX "/, 'CREATE UNIQUE INDEX IF NOT EXISTS "');
  }

  if (/^CREATE INDEX "/.test(s) && !/IF NOT EXISTS/.test(s)) {
    s = s.replace(/^CREATE INDEX "/, 'CREATE INDEX IF NOT EXISTS "');
  }

  if (/^ALTER TABLE .+ ADD COLUMN(?! IF NOT EXISTS) "/.test(s)) {
    s = s.replace(/^(ALTER TABLE .+?) ADD COLUMN "/, '$1 ADD COLUMN IF NOT EXISTS "');
  }

  const constraintMatch = s.match(/^ALTER TABLE .+ ADD CONSTRAINT "([^"]+)"/);
  if (constraintMatch) {
    return wrapConstraint(s, constraintMatch[1]);
  }

  return s;
}

function dedupeEnumStatements(statements) {
  const wrappedTypes = new Set();
  for (const stmt of statements) {
    const match = stmt.match(/CREATE TYPE "public"\."([^"]+)"/);
    if (match && /duplicate_object/.test(stmt)) {
      wrappedTypes.add(match[1]);
    }
  }

  return statements.filter((stmt) => {
    const unsafe = stmt.match(/^CREATE TYPE "public"\."([^"]+)"/);
    if (!unsafe) return true;
    if (/duplicate_object/.test(stmt)) return true;
    return !wrappedTypes.has(unsafe[1]);
  });
}

function transformFile(filePath) {
  const abs = resolve(filePath);
  const original = readFileSync(abs, "utf8");
  let statements = splitStatements(original);
  statements = dedupeEnumStatements(statements);
  statements = statements.map(transformStatement);
  const next = joinStatements(statements);
  if (next !== original.replace(/\r\n/g, "\n")) {
    writeFileSync(abs, next.endsWith("\n") ? next : `${next}\n`, "utf8");
    return true;
  }
  return false;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/idempotent-migration-sql.mjs <file.sql> [...]");
  process.exit(1);
}

let changed = 0;
for (const file of files) {
  if (transformFile(file)) {
    changed++;
    console.log(`Updated ${file}`);
  } else {
    console.log(`No changes ${file}`);
  }
}

console.log(`Done. ${changed}/${files.length} file(s) updated.`);
