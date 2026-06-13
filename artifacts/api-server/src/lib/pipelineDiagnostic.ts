import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { checkDatabaseConnection } from "../routes/health.js";
import {
  classifyDatabaseProbeError,
  evaluatePoolerExpectations,
  parseDatabaseTargetSafe,
  resolveDatabaseUrlBindingSource,
  sanitizeDatabaseErrorMessage,
} from "./databaseTargetDebug.js";
import { isDbConnectivityError } from "./dbConnectivity.js";
import { getInternalAuthSecret } from "./security/internalAuth.js";
import { BHUDHI_MODEL } from "./anthropic.js";

export type PipelineLayerResult = {
  ok: boolean;
  detail: string;
  durationMs?: number;
};

export type PipelineDiagnosticReport = {
  ok: boolean;
  rootCause: { layer: string; reason: string } | null;
  pipeline: Record<string, PipelineLayerResult>;
  failing: Array<{ layer: string; reason: string }>;
  passing: string[];
  recommendation: string;
};

const PIPELINE_TABLES = [
  "users",
  "blueprints",
  "validations",
  "orders",
  "signal_snapshots",
  "conditions",
  "enforcement_packages",
  "events",
  "bhudhi_logs",
  "feature_flags",
] as const;

async function layerEnvVars(): Promise<PipelineLayerResult> {
  const required = [
    "DATABASE_URL",
    "ANTHROPIC_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "INTERNAL_AUTH_SECRET",
  ] as const;
  const missing = required.filter((k) => !process.env[k]?.trim());
  return missing.length === 0
    ? { ok: true, detail: `All ${required.length} required vars present (via bindCloudflareEnv → process.env)` }
    : { ok: false, detail: `Missing: ${missing.join(", ")}` };
}

async function layerDatabase(): Promise<PipelineLayerResult> {
  const started = Date.now();
  const target = parseDatabaseTargetSafe(process.env.DATABASE_URL);
  const configIssues = evaluatePoolerExpectations(target);

  if (configIssues.length > 0) {
    return {
      ok: false,
      detail: `DATABASE_URL misconfigured: ${configIssues[0]}`,
      durationMs: Date.now() - started,
    };
  }

  try {
    await Promise.race([
      checkDatabaseConnection(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DB connection timed out after 8s")), 8000),
      ),
    ]);
    return {
      ok: true,
      detail: `Connected (${resolveDatabaseUrlBindingSource()}) — SELECT 1 OK`,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const elapsedMs = Date.now() - started;
    const { errorClass, errorMessage } = classifyDatabaseProbeError(
      err instanceof Error ? err.message : String(err),
      elapsedMs,
    );
    return {
      ok: false,
      detail: `[${errorClass}] ${errorMessage}`,
      durationMs: elapsedMs,
    };
  }
}

async function queryRows<T extends Record<string, unknown>>(queryText: string): Promise<T[]> {
  const result = await db.execute(sql.raw(queryText));
  return (result as { rows?: T[] }).rows ?? (result as unknown as T[]);
}

async function layerDatabaseTables(dbOk: boolean): Promise<PipelineLayerResult> {
  if (!dbOk) {
    return { ok: false, detail: "Skipped — database connection failed" };
  }

  const missing: string[] = [];
  const present: string[] = [];

  for (const table of PIPELINE_TABLES) {
    try {
      await queryRows(`SELECT 1 FROM ${table} LIMIT 1`);
      present.push(table);
    } catch {
      missing.push(table);
    }
  }

  return missing.length === 0
    ? { ok: true, detail: `All ${present.length} pipeline tables reachable` }
    : { ok: false, detail: `Missing or inaccessible: ${missing.join(", ")}` };
}

async function layerAnthropic(): Promise<PipelineLayerResult> {
  const started = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, detail: "ANTHROPIC_API_KEY not set", durationMs: Date.now() - started };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply: ok" }],
      }),
    });

    if (response.status === 401) {
      return { ok: false, detail: "ANTHROPIC_API_KEY invalid (401)", durationMs: Date.now() - started };
    }
    if (response.status === 529) {
      return {
        ok: true,
        detail: "API key accepted — Anthropic overloaded (529)",
        durationMs: Date.now() - started,
      };
    }
    if (!response.ok) {
      const body = sanitizeDatabaseErrorMessage(await response.text().catch(() => ""));
      return {
        ok: false,
        detail: `Anthropic HTTP ${response.status}: ${body.slice(0, 120)}`,
        durationMs: Date.now() - started,
      };
    }
    return {
      ok: true,
      detail: `Anthropic API reachable (HTTP ${response.status})`,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      detail: sanitizeDatabaseErrorMessage(err instanceof Error ? err.message : String(err)),
      durationMs: Date.now() - started,
    };
  }
}

async function layerBhudhiModule(): Promise<PipelineLayerResult> {
  try {
    const mod = await import("../bhudhi/BhudhiCore.js");
    const keys = Object.keys(mod).filter((k) => typeof (mod as Record<string, unknown>)[k] === "function");
    return {
      ok: true,
      detail: `BhudhiCore loaded (${keys.slice(0, 4).join(", ")}${keys.length > 4 ? ", …" : ""})`,
    };
  } catch (err) {
    return {
      ok: false,
      detail: sanitizeDatabaseErrorMessage(err instanceof Error ? err.message : String(err)),
    };
  }
}

async function layerBhudhiExecution(anthropicOk: boolean): Promise<PipelineLayerResult> {
  if (!anthropicOk) {
    return { ok: false, detail: "Skipped — Anthropic layer failed" };
  }
  const started = Date.now();
  try {
    const { structureGoalDeterministic } = await import("../engines/validation/ValidationEngine.js");
    const draft = structureGoalDeterministic({
      rawGoal: "Build a SaaS business in 90 days",
      purpose: "Financial independence",
      timeframe: "90 days",
      commitmentLevel: "high",
    });
    return {
      ok: draft.validationVerdict !== "INVALID",
      detail: `Deterministic structuring OK (verdict=${draft.validationVerdict})`,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      detail: sanitizeDatabaseErrorMessage(err instanceof Error ? err.message : String(err)),
      durationMs: Date.now() - started,
    };
  }
}

async function layerRouteModules(): Promise<PipelineLayerResult> {
  try {
    const [onboarding, bhudhi] = await Promise.all([
      import("../routes/onboarding.js"),
      import("../routes/bhudhi.js"),
    ]);
    const loaded = [onboarding.default, bhudhi.default].filter(Boolean).length;
    return { ok: loaded === 2, detail: `${loaded}/2 route modules loaded (onboarding, bhudhi)` };
  } catch (err) {
    return {
      ok: false,
      detail: sanitizeDatabaseErrorMessage(err instanceof Error ? err.message : String(err)),
    };
  }
}

async function layerOnboardingStatusLogic(dbOk: boolean): Promise<PipelineLayerResult> {
  if (!dbOk) {
    return { ok: false, detail: "Skipped — database connection failed" };
  }
  try {
    const rows = await queryRows<{ count: number | string }>(
      `SELECT COUNT(*)::int AS count FROM blueprints WHERE active = true LIMIT 1`,
    );
    const count = Number(rows[0]?.count ?? 0);
    return { ok: true, detail: `Active blueprints query OK (count=${count})` };
  } catch (err) {
    return {
      ok: false,
      detail: `onboarding/status query would fail: ${sanitizeDatabaseErrorMessage(
        err instanceof Error ? err.message : String(err),
      )}`,
    };
  }
}

async function layerDbTargetSummary(): Promise<PipelineLayerResult> {
  const target = parseDatabaseTargetSafe(process.env.DATABASE_URL);
  const issues = evaluatePoolerExpectations(target);
  if (!target.configured) {
    return { ok: false, detail: "DATABASE_URL not configured" };
  }
  const summary = [
    target.host ? `host=${target.host}` : null,
    target.port ? `port=${target.port}` : null,
    target.isPoolerHost ? "pooler=yes" : "pooler=no",
    target.isTransactionPoolerPort ? "txn_port=yes" : "txn_port=no",
    target.projectRef ? `ref=${target.projectRef}` : "ref=missing",
  ]
    .filter(Boolean)
    .join(", ");
  return issues.length === 0
    ? { ok: true, detail: summary }
    : { ok: false, detail: `${summary}; issues: ${issues[0]}` };
}

export async function runPipelineDiagnostic(): Promise<PipelineDiagnosticReport> {
  const pipeline: Record<string, PipelineLayerResult> = {};

  pipeline.env_vars = await layerEnvVars();
  pipeline.database_url_shape = await layerDbTargetSummary();
  pipeline.database = await layerDatabase();
  pipeline.database_tables = await layerDatabaseTables(pipeline.database.ok);
  pipeline.anthropic = await layerAnthropic();
  pipeline.bhudhi_module = await layerBhudhiModule();
  pipeline.bhudhi_execution = await layerBhudhiExecution(pipeline.anthropic.ok);
  pipeline.route_modules = await layerRouteModules();
  pipeline.onboarding_status_logic = await layerOnboardingStatusLogic(pipeline.database.ok);

  const failing = Object.entries(pipeline)
    .filter(([, v]) => !v.ok)
    .map(([layer, v]) => ({ layer, reason: v.detail }));

  const rootCause = failing[0] ?? null;
  const allOk = failing.length === 0;

  return {
    ok: allOk,
    rootCause,
    pipeline,
    failing,
    passing: Object.entries(pipeline)
      .filter(([, v]) => v.ok)
      .map(([k]) => k),
    recommendation: rootCause
      ? `Fix ${rootCause.layer} first: ${rootCause.reason}`
      : "All pipeline layers operational",
  };
}

/** Used by diagnostic route to confirm internal auth is configured (never returns secret). */
export function internalAuthConfigured(): boolean {
  return Boolean(getInternalAuthSecret());
}

export function bhudhiModelConfigured(): string {
  return process.env.BHUDHI_MODEL?.trim() || BHUDHI_MODEL;
}

export { isDbConnectivityError };
