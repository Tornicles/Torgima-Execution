#!/usr/bin/env node
/**
 * Start local Postgres for Phase 9 E2E (CI parity: postgres/postgres @ :5432/torgima_test).
 * Tries Docker Compose first, then embedded-postgres (no Docker required on Windows).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localDir = join(root, ".local");
// Use utf8-labelled dir so Windows embedded clusters are not stuck on WIN1252.
const dataDir = join(localDir, "postgres-data-utf8");
const port = Number(process.env.POSTGRES_PORT ?? 5432);
const user = "postgres";
const password = "postgres";
const database = "torgima_test";
const databaseUrl = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;

async function writeEnvFile() {
  await mkdir(localDir, { recursive: true });
  const envContent = [
    `DATABASE_URL=${databaseUrl}`,
    `DIRECT_URL=${databaseUrl}`,
    `TEST_DATABASE_URL=${databaseUrl}`,
    "",
  ].join("\n");
  await writeFile(join(localDir, "postgres.env"), envContent, "utf8");
  await writeFile(join(root, ".env.local"), envContent, "utf8");
}

function hasCommand(cmd) {
  const r = spawnSync(cmd, ["--version"], { shell: true, stdio: "ignore" });
  return r.status === 0;
}

async function waitForPostgres(maxMs = 120_000) {
  const { default: pg } = await import("pg");
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    try {
      const client = new pg.Client({ connectionString: databaseUrl });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return false;
}

async function startDocker() {
  if (!hasCommand("docker")) return false;
  console.log("[postgres] Starting Docker Compose (postgres:15)...");
  const up = spawnSync(
    "docker",
    ["compose", "-f", "docker-compose.postgres.yml", "up", "-d", "--wait"],
    { cwd: root, stdio: "inherit", shell: true },
  );
  if (up.status !== 0) return false;
  return waitForPostgres();
}

async function startEmbedded() {
  console.log("[postgres] Starting embedded-postgres (port %s)...", port);
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  await mkdir(dataDir, { recursive: true });

  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user,
    password,
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  if (!existsSync(join(dataDir, "PG_VERSION"))) {
    await instance.initialise();
  }
  await instance.start();

  const { default: pg } = await import("pg");
  const admin = new pg.Client({
    connectionString: `postgresql://${user}:${password}@127.0.0.1:${port}/postgres`,
  });
  await admin.connect();
  const exists = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [database]);
  if ((exists.rowCount ?? 0) === 0) {
    await admin.query(`CREATE DATABASE ${database}`);
  }
  await admin.end();

  await writeFile(
    join(localDir, "embedded-postgres.json"),
    JSON.stringify({ mode: "embedded", port, dataDir }, null, 2),
    "utf8",
  );

  return waitForPostgres();
}

async function main() {
  await mkdir(localDir, { recursive: true });

  if (await startDocker()) {
    await writeFile(join(localDir, "embedded-postgres.json"), JSON.stringify({ mode: "docker" }), "utf8");
    await writeEnvFile();
    console.log("[postgres] Ready (Docker): %s", databaseUrl);
    return;
  }

  if (await startEmbedded()) {
    await writeEnvFile();
    console.log("[postgres] Ready (embedded): %s", databaseUrl);
    return;
  }

  console.error(
    "[postgres] Failed to start. Install Docker Desktop OR run: pnpm install && pnpm postgres:embedded",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
