import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");
dotenv.config({ path: join(repoRoot, ".env.local") });
dotenv.config({ path: join(repoRoot, ".env") });
dotenv.config({ path: join(repoRoot, "artifacts/api-server/.env") });
process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

const { db, pool } = await import("./index.js");
import {
  bhudhiSystems,
  bhudhiEngines,
  bhudhiFrameworks,
  bhudhiDomains,
  bhudhiModules,
} from "./schema/bhudhiTables.js";
import {
  BHUDHI_SYSTEMS,
  BHUDHI_ENGINES,
  BHUDHI_FRAMEWORKS,
  BHUDHI_DOMAINS,
  BHUDHI_MODULES,
} from "./bhudhi-seed-data.js";

const DEFAULT_METRICS = {
  executionsCount: 0,
  successRate: 0,
  averageExecutionTime: 0,
  lastResultCount: 0,
};

export async function seedBhudhiCatalog(): Promise<void> {
  const now = new Date();

  for (const system of BHUDHI_SYSTEMS) {
    const engineCount = BHUDHI_ENGINES.filter((e) => e.systemId === system.id).length;
    await db
      .insert(bhudhiSystems)
      .values({
        id: system.id,
        name: system.name,
        description: system.description,
        status: "active",
        last_analyzed_at: now,
        engine_count: engineCount,
      })
      .onConflictDoUpdate({
        target: bhudhiSystems.id,
        set: {
          description: system.description,
          engine_count: engineCount,
          last_analyzed_at: now,
          updated_at: now,
        },
      });
  }

  for (const engine of BHUDHI_ENGINES) {
    await db
      .insert(bhudhiEngines)
      .values({
        id: engine.id,
        system_id: engine.systemId,
        name: engine.name,
        type: engine.type,
        description: engine.description,
        status: "active",
        configuration: {},
        metrics: DEFAULT_METRICS,
      })
      .onConflictDoUpdate({
        target: bhudhiEngines.id,
        set: {
          description: engine.description,
          updated_at: now,
        },
      });
  }

  for (const fw of BHUDHI_FRAMEWORKS) {
    await db
      .insert(bhudhiFrameworks)
      .values({
        id: fw.id,
        name: fw.name,
        type: fw.type,
        description: fw.description,
        domains: fw.domains,
        status: fw.id === "culture_dynamics" ? "inactive" : "active",
        logic: { evaluation: "phase1_overlay" },
        accuracy: fw.accuracy,
        confidence_threshold: 0.7,
        improvement_history: [],
        weekly_accuracy: [],
      })
      .onConflictDoUpdate({
        target: bhudhiFrameworks.id,
        set: {
          description: fw.description,
          domains: fw.domains,
          accuracy: fw.accuracy,
          updated_at: now,
        },
      });
  }

  for (const domain of BHUDHI_DOMAINS) {
    await db
      .insert(bhudhiDomains)
      .values({
        id: domain.id,
        name: domain.name,
        description: domain.description,
        active_frameworks: domain.activeFrameworks,
        framework_roles: domain.frameworkRoles,
        settings: { phase: 1 },
      })
      .onConflictDoUpdate({
        target: bhudhiDomains.id,
        set: {
          description: domain.description,
          active_frameworks: domain.activeFrameworks,
          framework_roles: domain.frameworkRoles,
          updated_at: now,
        },
      });
  }

  for (const mod of BHUDHI_MODULES) {
    await db
      .insert(bhudhiModules)
      .values({
        id: mod.id,
        name: mod.name,
        system: mod.system,
        description: mod.description,
        status: "active",
        inputs: mod.inputs,
        outputs: mod.outputs,
        logic: mod.logic,
        accuracy: mod.accuracy,
        execution_time_ms: 0,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: bhudhiModules.id,
        set: {
          description: mod.description,
          system: mod.system,
          inputs: mod.inputs,
          outputs: mod.outputs,
          logic: mod.logic,
          accuracy: mod.accuracy,
          updated_at: now,
        },
      });
  }

  console.log(
    `Bhudhi catalog seeded: ${BHUDHI_SYSTEMS.length} systems, ${BHUDHI_ENGINES.length} engines, ${BHUDHI_FRAMEWORKS.length} frameworks, ${BHUDHI_DOMAINS.length} domains, ${BHUDHI_MODULES.length} modules`,
  );
}

/** Verify FK relationships without requiring blueprint rows. */
export async function verifyBhudhiRelationships(): Promise<boolean> {
  const [systems, engines, frameworks, domains, modules] = await Promise.all([
    db.select({ id: bhudhiSystems.id }).from(bhudhiSystems),
    db.select({ id: bhudhiEngines.id, system_id: bhudhiEngines.system_id }).from(bhudhiEngines),
    db.select({ id: bhudhiFrameworks.id }).from(bhudhiFrameworks),
    db.select({ id: bhudhiDomains.id }).from(bhudhiDomains),
    db.select({ id: bhudhiModules.id, system: bhudhiModules.system }).from(bhudhiModules),
  ]);

  const systemIds = new Set(systems.map((s) => s.id));
  const orphanEngines = engines.filter((e) => !systemIds.has(e.system_id));
  if (orphanEngines.length > 0) {
    console.error("Orphan engines:", orphanEngines.map((e) => e.id));
    return false;
  }

  const engineJoin = await db.execute<{ cnt: string }>(sql`
    SELECT count(*)::text AS cnt
    FROM bhudhi_engines e
    INNER JOIN bhudhi_systems s ON s.id = e.system_id
  `);
  const joined = Number(engineJoin.rows[0]?.cnt ?? 0);
  if (joined !== engines.length) {
    console.error(`Engine/system join mismatch: ${joined} vs ${engines.length}`);
    return false;
  }

  console.log(
    `Bhudhi relationships OK: systems=${systems.length} engines=${engines.length} frameworks=${frameworks.length} domains=${domains.length} modules=${modules.length}`,
  );
  return (
    systems.length === 5 &&
    engines.length >= 40 &&
    frameworks.length === 15 &&
    domains.length === 7 &&
    modules.length === 8
  );
}

const verifyOnly = process.argv.includes("--verify-only");

async function main() {
  if (!verifyOnly) {
    await seedBhudhiCatalog();
  }
  const ok = await verifyBhudhiRelationships();
  if (!ok) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
