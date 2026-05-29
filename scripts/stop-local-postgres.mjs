#!/usr/bin/env node
import { readFile, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const metaPath = join(root, ".local", "embedded-postgres.json");

async function main() {
  let meta = { mode: "unknown" };
  try {
    meta = JSON.parse(await readFile(metaPath, "utf8"));
  } catch {
    /* no meta */
  }

  if (meta.mode === "docker") {
    spawnSync("docker", ["compose", "-f", "docker-compose.postgres.yml", "down"], {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
  } else if (meta.mode === "embedded" && meta.dataDir) {
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    const instance = new EmbeddedPostgres({
      databaseDir: meta.dataDir,
      port: meta.port ?? 5432,
      user: "postgres",
      password: "postgres",
      persistent: true,
    });
    await instance.initialise();
    await instance.stop();
  }

  try {
    await unlink(metaPath);
  } catch {
    /* ignore */
  }
  console.log("[postgres] Stopped");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
