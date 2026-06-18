/**
 * Worker-safe database probes — Supabase PostgREST HTTP (1 subrequest) on Cloudflare;
 * postgres-js fallback for Node.
 */
import { executeHealthSql } from "@workspace/db";
import { isCloudflareRuntime } from "./cloudflare-runtime.js";
import {
  buildDatabaseHealthFailure,
  buildSafeDatabaseTargetSnapshot,
} from "./databaseTargetDebug.js";

export type WorkerDatabaseProbeResult = {
  ok: boolean;
  detail: string;
  driver: "supabase-http" | "postgres-js" | "node-postgres";
  runtime: string;
  host: string | null;
  port: string | null;
  ssl: boolean;
  elapsedMs: number;
  error_name?: string;
  error_code?: string | null;
  error_message_safe?: string;
  error_class?: string;
};

function supabaseRestConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

async function probeViaSupabaseHttp(): Promise<{ ok: boolean; detail: string }> {
  const cfg = supabaseRestConfig();
  if (!cfg) {
    return { ok: false, detail: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured" };
  }

  const res = await fetch(`${cfg.url}/rest/v1/blueprints?select=id&limit=1`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Accept: "application/json",
    },
  });

  if (res.ok) {
    return { ok: true, detail: "Supabase PostgREST reachable — blueprints head OK" };
  }

  const text = (await res.text()).slice(0, 200);
  return { ok: false, detail: `Supabase PostgREST HTTP ${res.status}: ${text}` };
}

export async function probeWorkerDatabaseConnection(): Promise<WorkerDatabaseProbeResult> {
  const started = Date.now();
  const dbUrl = process.env.DATABASE_URL;
  const target = buildSafeDatabaseTargetSnapshot(dbUrl);
  const runtime = isCloudflareRuntime() ? "cloudflare-workers" : "node";

  if (isCloudflareRuntime()) {
    try {
      const http = await probeViaSupabaseHttp();
      if (http.ok) {
        return {
          ok: true,
          detail: http.detail,
          driver: "supabase-http",
          runtime,
          host: target.host,
          port: target.port,
          ssl: target.sslEnabled,
          elapsedMs: Date.now() - started,
        };
      }
      return {
        ok: false,
        detail: http.detail,
        driver: "supabase-http",
        runtime,
        host: target.host,
        port: target.port,
        ssl: target.sslEnabled,
        elapsedMs: Date.now() - started,
        error_class: "NETWORK",
        error_message_safe: http.detail,
        error_name: "SupabaseHttpProbeError",
        error_code: null,
      };
    } catch (err) {
      const failure = buildDatabaseHealthFailure(err, Date.now() - started, dbUrl);
      return {
        ...failure,
        driver: "supabase-http",
        runtime,
        host: target.host,
        port: target.port,
        ssl: target.sslEnabled,
        elapsedMs: Date.now() - started,
        detail: failure.detail,
      };
    }
  }

  try {
    await executeHealthSql("SELECT 1 AS ping");
    return {
      ok: true,
      detail: "Connected — SELECT 1 OK",
      driver: isCloudflareRuntime() ? "postgres-js" : "node-postgres",
      runtime,
      host: target.host,
      port: target.port,
      ssl: target.sslEnabled,
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    const failure = buildDatabaseHealthFailure(err, Date.now() - started, dbUrl);
    return {
      ...failure,
      driver: isCloudflareRuntime() ? "postgres-js" : "node-postgres",
      runtime,
      host: target.host,
      port: target.port,
      ssl: target.sslEnabled,
      elapsedMs: Date.now() - started,
      detail: failure.detail,
    };
  }
}

export async function probeWorkerSignalRecency(maxAgeHours = 48): Promise<{
  ok: boolean;
  detail: string;
  ageHours: number | null;
}> {
  if (isCloudflareRuntime()) {
    const cfg = supabaseRestConfig();
    if (!cfg) {
      return { ok: false, detail: "Supabase HTTP not configured for signal probe", ageHours: null };
    }

    const activeRes = await fetch(
      `${cfg.url}/rest/v1/blueprints?select=id&active=eq.true&status=eq.active&limit=1`,
      {
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          Prefer: "count=exact",
          Accept: "application/json",
        },
      },
    );

    const activeCount = Number(activeRes.headers.get("content-range")?.split("/")[1] ?? 0);
    if (!activeCount) {
      return { ok: true, detail: "No active blueprints — skipped", ageHours: null };
    }

    const signalRes = await fetch(
      `${cfg.url}/rest/v1/signal_snapshots?select=created_at&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          Accept: "application/json",
        },
      },
    );

    if (!signalRes.ok) {
      return {
        ok: false,
        detail: `signal_snapshots probe HTTP ${signalRes.status}`,
        ageHours: null,
      };
    }

    const rows = (await signalRes.json()) as Array<{ created_at?: string }>;
    const latest = rows[0]?.created_at;
    if (!latest) {
      return {
        ok: false,
        detail: "no signal snapshots while active blueprints exist",
        ageHours: null,
      };
    }

    const ageHours = (Date.now() - new Date(latest).getTime()) / (60 * 60 * 1000);
    if (ageHours > maxAgeHours) {
      return {
        ok: false,
        detail: `latest signal snapshot is stale: ${ageHours.toFixed(1)}h`,
        ageHours,
      };
    }

    return {
      ok: true,
      detail: `Latest signal ${ageHours.toFixed(1)}h ago`,
      ageHours,
    };
  }

  const rows = await executeHealthSql<{ active: number | string; latest: Date | string | null }>(
    `SELECT
      (SELECT COUNT(*)::int FROM blueprints WHERE active = true AND status = 'active') AS active,
      (SELECT MAX(created_at) FROM signal_snapshots) AS latest`,
  );
  const activeBlueprints = Number(rows[0]?.active ?? 0);
  if (!activeBlueprints) {
    return { ok: true, detail: "No active blueprints — skipped", ageHours: null };
  }
  const latest = rows[0]?.latest;
  if (!latest) {
    return { ok: false, detail: "no signal snapshots while active blueprints exist", ageHours: null };
  }
  const ageHours = (Date.now() - new Date(latest).getTime()) / (60 * 60 * 1000);
  if (ageHours > maxAgeHours) {
    return { ok: false, detail: `latest signal snapshot is stale: ${ageHours.toFixed(1)}h`, ageHours };
  }
  return {
    ok: true,
    detail: `Latest signal ${ageHours.toFixed(1)}h ago`,
    ageHours,
  };
}
