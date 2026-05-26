import { pool } from "@workspace/db";
import { checkDatabaseConnection, checkPgBossWorkers } from "../routes/health.js";

export interface BhudhiHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: boolean;
    eventBus: boolean;
    memory: boolean;
    execution: boolean;
    catalog: boolean;
    workers: boolean;
  };
  latencies: {
    database: number;
    eventBus: number;
    memory: number;
    execution: number;
  };
  counts: {
    kernelEvents: number | null;
    memoryNodes: number | null;
    executionContexts: number | null;
    catalogSystems: number | null;
  };
  errors: string[];
}

async function timedCount(
  sql: string,
): Promise<{ ok: boolean; ms: number; count: number; error?: string }> {
  const start = Date.now();
  try {
    const result = await pool.query<{ c: string }>(sql);
    return {
      ok: true,
      ms: Date.now() - start,
      count: Number(result.rows[0]?.c ?? 0),
    };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - start,
      count: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export class BhudhiHealthCheck {
  async check(): Promise<BhudhiHealthStatus> {
    const errors: string[] = [];
    const checks = {
      database: false,
      eventBus: false,
      memory: false,
      execution: false,
      catalog: false,
      workers: false,
    };
    const latencies = {
      database: 0,
      eventBus: 0,
      memory: 0,
      execution: 0,
    };
    const counts = {
      kernelEvents: null as number | null,
      memoryNodes: null as number | null,
      executionContexts: null as number | null,
      catalogSystems: null as number | null,
    };

    const dbStart = Date.now();
    try {
      await checkDatabaseConnection();
      checks.database = true;
      latencies.database = Date.now() - dbStart;
    } catch (err) {
      errors.push(`Database: ${err instanceof Error ? err.message : String(err)}`);
      latencies.database = Date.now() - dbStart;
    }

    const events = await timedCount(
      "SELECT COUNT(*)::int AS c FROM bhudhi_kernel_events",
    );
    latencies.eventBus = events.ms;
    if (events.ok) {
      checks.eventBus = true;
      counts.kernelEvents = events.count;
    } else if (events.error?.includes("does not exist")) {
      errors.push("Event bus: run migration 0026");
    } else {
      errors.push(`Event bus: ${events.error}`);
    }

    const nodes = await timedCount("SELECT COUNT(*)::int AS c FROM bhudhi_memory_nodes");
    latencies.memory = nodes.ms;
    if (nodes.ok) {
      checks.memory = true;
      counts.memoryNodes = nodes.count;
    } else if (nodes.error?.includes("does not exist")) {
      errors.push("Memory graph: run migration 0027");
    } else {
      errors.push(`Memory: ${nodes.error}`);
    }

    const exec = await timedCount(
      "SELECT COUNT(*)::int AS c FROM bhudhi_unified_execution_contexts",
    );
    latencies.execution = exec.ms;
    if (exec.ok) {
      checks.execution = true;
      counts.executionContexts = exec.count;
    } else if (exec.error?.includes("does not exist")) {
      errors.push("Execution runtime: run migration 0029");
    } else {
      errors.push(`Execution: ${exec.error}`);
    }

    const catalog = await timedCount("SELECT COUNT(*)::int AS c FROM bhudhi_systems");
    if (catalog.ok) {
      checks.catalog = catalog.count > 0;
      counts.catalogSystems = catalog.count;
      if (!checks.catalog) {
        errors.push("Catalog empty — run seed:bhudhi");
      }
    } else {
      errors.push(`Catalog: ${catalog.error}`);
    }

    try {
      await checkPgBossWorkers();
      checks.workers = true;
    } catch (err) {
      errors.push(`Workers: ${err instanceof Error ? err.message : String(err)}`);
    }

    const coreOk = checks.database && checks.eventBus && checks.memory && checks.execution;
    const status: BhudhiHealthStatus["status"] = coreOk && checks.catalog && checks.workers
      ? "healthy"
      : errors.length > 2
        ? "unhealthy"
        : "degraded";

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION ?? "2.0.0",
      checks,
      latencies,
      counts,
      errors,
    };
  }
}

export const bhudhiHealthCheck = new BhudhiHealthCheck();
