/**
 * Shared production HTTP / Supabase Management API probe helpers.
 * Never logs secrets or full connection strings.
 */
import { EXPECTED_PROJECT_REF } from "./db-prod-common.mjs";

export const CANONICAL_API_BASE =
  process.env.VITE_API_BASE_URL?.trim()?.replace(/\/$/, "") ||
  process.env.TORGIMA_API_BASE_URL?.trim()?.replace(/\/$/, "") ||
  "https://api.torgima.com";

export const DEFAULT_WORKERS_DEV_URL = "https://torgima.tmagaya.workers.dev";

export const PROBE_USER_AGENT = "GitHub-Actions-Deploy-Verify/1.0";

export const FAILURE_CLASSES = {
  CANONICAL_API_HEALTH_PASS: "CANONICAL_API_HEALTH_PASS",
  CANONICAL_API_HEALTH_FAIL: "CANONICAL_API_HEALTH_FAIL",
  CANONICAL_DEBUG_DB_TARGET_PASS: "CANONICAL_DEBUG_DB_TARGET_PASS",
  CANONICAL_DEBUG_BHUDHI_PASS: "CANONICAL_DEBUG_BHUDHI_PASS",
  CANONICAL_API_HEALTH_READINESS_PASS: "CANONICAL_API_HEALTH_READINESS_PASS",
  CANONICAL_API_HEALTH_READINESS_FAIL: "CANONICAL_API_HEALTH_READINESS_FAIL",
  WORKERS_DEV_ROUTE_404_OPTIONAL: "WORKERS_DEV_ROUTE_404_OPTIONAL",
  WORKERS_DEV_DEBUG_PASS: "WORKERS_DEV_DEBUG_PASS",
  WORKERS_DEV_DEBUG_FAIL: "WORKERS_DEV_DEBUG_FAIL",
  INTERNAL_AUTH_SECRET_MISSING: "INTERNAL_AUTH_SECRET_MISSING",
  INTERNAL_AUTH_SECRET_MISMATCH: "INTERNAL_AUTH_SECRET_MISMATCH",
  DEBUG_ROUTE_NOT_DEPLOYED: "DEBUG_ROUTE_NOT_DEPLOYED",
  SUPABASE_MANAGEMENT_API_PASS: "SUPABASE_MANAGEMENT_API_PASS",
  SUPABASE_MANAGEMENT_API_TIMEOUT: "SUPABASE_MANAGEMENT_API_TIMEOUT",
  SUPABASE_MANAGEMENT_API_FAIL: "SUPABASE_MANAGEMENT_API_FAIL",
  SUPABASE_MANAGEMENT_API_SKIPPED: "SUPABASE_MANAGEMENT_API_SKIPPED",
  DATABASE_URL_AUTH_FAILED: "DATABASE_URL_AUTH_FAILED",
  DATABASE_URL_TIMEOUT: "DATABASE_URL_TIMEOUT",
};

export function resolveWorkersDevUrl() {
  const raw = process.env.WORKER_URL?.trim() || process.env.CLOUDFLARE_WORKER_URL?.trim() || "";
  return (raw || DEFAULT_WORKERS_DEV_URL).replace(/\/$/, "");
}

export function resolveInternalAuthSecret() {
  const secret =
    process.env.INTERNAL_AUTH_SECRET?.trim() ||
    process.env.INTERNAL_SERVICE_SECRET?.trim() ||
    "";
  if (!secret) {
    return { ok: false, class: FAILURE_CLASSES.INTERNAL_AUTH_SECRET_MISSING };
  }
  return { ok: true, secret };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(url, init = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": PROBE_USER_AGENT,
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { res, body, text };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse /health liveness — accepts boolean true, { ok: true }, or known healthy JSON bodies.
 */
export function parseHealthLivenessResponse(status, body) {
  if (status !== 200) {
    return { ok: false, class: FAILURE_CLASSES.CANONICAL_API_HEALTH_FAIL };
  }

  if (body === true) {
    return { ok: true, class: FAILURE_CLASSES.CANONICAL_API_HEALTH_PASS };
  }
  if (body === false) {
    return { ok: false, class: FAILURE_CLASSES.CANONICAL_API_HEALTH_FAIL };
  }

  if (typeof body === "string") {
    const trimmed = body.trim();
    if (trimmed === "true") {
      return { ok: true, class: FAILURE_CLASSES.CANONICAL_API_HEALTH_PASS };
    }
    if (trimmed === "false") {
      return { ok: false, class: FAILURE_CLASSES.CANONICAL_API_HEALTH_FAIL };
    }
    if (/"ok"\s*:\s*true/.test(trimmed) || /"status"\s*:\s*"(healthy|operational)"/.test(trimmed)) {
      return { ok: true, class: FAILURE_CLASSES.CANONICAL_API_HEALTH_PASS };
    }
    return { ok: false, class: FAILURE_CLASSES.CANONICAL_API_HEALTH_FAIL };
  }

  if (typeof body === "object" && body !== null) {
    if (body.ok === true) {
      return { ok: true, class: FAILURE_CLASSES.CANONICAL_API_HEALTH_PASS };
    }
    if (body.ok === false) {
      return { ok: false, class: FAILURE_CLASSES.CANONICAL_API_HEALTH_FAIL };
    }
    if (body.status === "healthy" || body.status === "operational") {
      return { ok: true, class: FAILURE_CLASSES.CANONICAL_API_HEALTH_PASS };
    }
  }

  return { ok: false, class: FAILURE_CLASSES.CANONICAL_API_HEALTH_FAIL };
}

export async function probeHealth(baseUrl, options = {}) {
  const optional = Boolean(options.optional);
  const url = `${baseUrl.replace(/\/$/, "")}/health`;
  try {
    const { res, body } = await fetchWithTimeout(url, {}, 20_000);

    if (optional && (res.status === 404 || res.status === 1042)) {
      return {
        ok: false,
        warn: true,
        status: res.status,
        class: FAILURE_CLASSES.WORKERS_DEV_ROUTE_404_OPTIONAL,
        url,
        liveness: true,
      };
    }

    const parsed = parseHealthLivenessResponse(res.status, body);
    return {
      ok: parsed.ok,
      status: res.status,
      class: parsed.class,
      url,
      liveness: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = /abort|timeout|deadline/i.test(msg);
    return {
      ok: false,
      warn: optional,
      status: 0,
      class: optional
        ? FAILURE_CLASSES.WORKERS_DEV_ROUTE_404_OPTIONAL
        : isTimeout
          ? FAILURE_CLASSES.DATABASE_URL_TIMEOUT
          : FAILURE_CLASSES.CANONICAL_API_HEALTH_FAIL,
      url,
      detail: msg,
      liveness: true,
    };
  }
}

/**
 * Deep readiness — GET /api/health with x-internal-auth (DB + signals checks).
 */
export async function probeApiHealthReadiness(baseUrl, internalSecret, timeoutMs = 45_000) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/health`;
  if (!internalSecret) {
    return {
      ok: false,
      status: 0,
      class: FAILURE_CLASSES.INTERNAL_AUTH_SECRET_MISSING,
      url,
      readiness: true,
    };
  }

  try {
    const { res, body } = await fetchWithTimeout(
      url,
      { headers: { "x-internal-auth": internalSecret } },
      timeoutMs,
    );
    const data = typeof body === "object" ? body : {};
    const ok = res.status === 200 && data.ok === true && data.status === "healthy";
    return {
      ok,
      status: res.status,
      class: ok
        ? FAILURE_CLASSES.CANONICAL_API_HEALTH_READINESS_PASS
        : FAILURE_CLASSES.CANONICAL_API_HEALTH_READINESS_FAIL,
      url,
      readiness: true,
      detail: ok
        ? "deep readiness healthy"
        : data.failing
          ? JSON.stringify(data.failing).slice(0, 300)
          : data.status ?? `HTTP ${res.status}`,
      checks: data.checks ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      class: /abort|timeout|deadline/i.test(msg)
        ? FAILURE_CLASSES.DATABASE_URL_TIMEOUT
        : FAILURE_CLASSES.CANONICAL_API_HEALTH_READINESS_FAIL,
      url,
      readiness: true,
      detail: msg,
    };
  }
}

export function classifyDebugProbeFailure(status, bodyText = "", body = null) {
  if (status === 403) {
    const forbidden =
      typeof body === "object" &&
      body !== null &&
      (body?.error?.code === "FORBIDDEN" || body?.error?.message === "Internal auth required");
    return forbidden
      ? FAILURE_CLASSES.INTERNAL_AUTH_SECRET_MISMATCH
      : FAILURE_CLASSES.INTERNAL_AUTH_SECRET_MISMATCH;
  }
  if (status === 404 || status === 1042 || /error code: 1042/i.test(bodyText)) {
    return FAILURE_CLASSES.DEBUG_ROUTE_NOT_DEPLOYED;
  }
  return FAILURE_CLASSES.WORKERS_DEV_DEBUG_FAIL;
}

/**
 * Debug routes: app.ts mounts router at /api; debug.ts registers /debug/*.
 * Final external path: /api/debug/db-target
 */
export async function probeDebugRoute(baseUrl, path, internalSecret, timeoutMs = 30_000) {
  const url = `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  if (!internalSecret) {
    return {
      ok: false,
      status: 0,
      class: FAILURE_CLASSES.INTERNAL_AUTH_SECRET_MISSING,
      url,
    };
  }

  try {
    const { res, body, text } = await fetchWithTimeout(
      url,
      { headers: { "x-internal-auth": internalSecret } },
      timeoutMs,
    );

    if (res.status === 200) {
      const data = body?.data ?? body;
      return { ok: true, status: res.status, class: "PASS", url, data };
    }

    if (String(text).includes("Just a moment")) {
      return {
        ok: false,
        status: res.status,
        class: FAILURE_CLASSES.WORKERS_DEV_DEBUG_FAIL,
        url,
        detail: "Cloudflare managed challenge HTML",
      };
    }

    return {
      ok: false,
      status: res.status,
      class: classifyDebugProbeFailure(res.status, text, body),
      url,
      detail: typeof body === "object" ? body?.error?.message ?? body?.message : String(text).slice(0, 200),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      class: /abort|timeout|deadline/i.test(msg)
        ? FAILURE_CLASSES.DATABASE_URL_TIMEOUT
        : FAILURE_CLASSES.WORKERS_DEV_DEBUG_FAIL,
      url,
      detail: msg,
    };
  }
}

export async function fetchSupabaseManagementConfig(projectRef = EXPECTED_PROJECT_REF) {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    return {
      ok: null,
      class: FAILURE_CLASSES.SUPABASE_MANAGEMENT_API_SKIPPED,
      detail: "SUPABASE_ACCESS_TOKEN not configured",
      endpoints: [],
    };
  }

  const endpoints = [
    `/projects/${projectRef}/config/database/postgres`,
    `/projects/${projectRef}/config/storage`,
  ];
  const delays = [5_000, 10_000, 20_000];
  const results = [];
  let anyTimeout = false;
  let allPass = true;

  for (const endpoint of endpoints) {
    const url = `https://api.supabase.com/v1${endpoint}`;
    let lastError = null;
    let passed = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { res } = await fetchWithTimeout(
          url,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          },
          45_000,
        );
        if (res.ok) {
          passed = true;
          results.push({ endpoint, status: res.status, attempt: attempt + 1 });
          break;
        }
        lastError = `HTTP ${res.status}`;
        if (res.status < 500) break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (/abort|timeout|deadline/i.test(lastError)) anyTimeout = true;
      }
      if (attempt < 2) await sleep(delays[attempt] ?? 20_000);
    }

    if (!passed) {
      allPass = false;
      results.push({ endpoint, error: lastError });
    }
  }

  if (allPass) {
    return { ok: true, class: FAILURE_CLASSES.SUPABASE_MANAGEMENT_API_PASS, endpoints: results };
  }
  if (anyTimeout) {
    return {
      ok: false,
      warn: true,
      class: FAILURE_CLASSES.SUPABASE_MANAGEMENT_API_TIMEOUT,
      endpoints: results,
    };
  }
  return {
    ok: false,
    warn: false,
    class: FAILURE_CLASSES.SUPABASE_MANAGEMENT_API_FAIL,
    endpoints: results,
  };
}

export function printProbeResult(label, result) {
  const status = result.ok ? "PASS" : result.warn ? "WARN" : "FAIL";
  const detail = result.detail ? ` — ${result.detail}` : "";
  const code = result.class ? ` [${result.class}]` : "";
  console.log(`${status}  ${label}${code}${detail}`);
  if (result.url) console.log(`       ${result.url}`);
}
