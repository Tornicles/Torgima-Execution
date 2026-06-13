/**
 * Safe DATABASE_URL diagnostics for /api/debug/db-target — never returns secrets.
 */

const EXPECTED_PROJECT_REF = "fmynbziciuadnvjlojub";

export type DatabaseUrlBindingSource = "hyperdrive" | "worker_secret" | "unset";

export type ParsedDatabaseTarget = {
  configured: boolean;
  bindingSource: DatabaseUrlBindingSource;
  host: string | null;
  port: string | null;
  database: string | null;
  usernamePrefix: string | null;
  projectRef: string | null;
  sslEnabled: boolean;
  isPoolerHost: boolean;
  isTransactionPoolerPort: boolean;
  passwordPresent: boolean;
  passwordEncodingSuspect: boolean;
  expectsPoolerHost: boolean;
  expectsTransactionPort: boolean;
  expectsProjectRef: boolean;
  parseError: string | null;
};

export type DatabaseProbeResult = {
  ok: boolean;
  elapsedMs: number;
  errorClass: string | null;
  errorMessage: string | null;
};

export function resolveDatabaseUrlBindingSource(): DatabaseUrlBindingSource {
  if (globalThis.__TORGIMA_HYPERDRIVE__) return "hyperdrive";
  if (process.env.DATABASE_URL?.trim()) return "worker_secret";
  return "unset";
}

/** Strip credentials and query params that may contain secrets from error text. */
export function sanitizeDatabaseErrorMessage(raw: string): string {
  let msg = raw;
  msg = msg.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://***@");
  msg = msg.replace(/password[=:]\s*['"]?[^'"\s]+/gi, "password=***");
  msg = msg.replace(/user[=:]\s*['"]?[^'"\s]+/gi, "user=***");
  return msg.slice(0, 500);
}

export function classifyDatabaseProbeError(
  rawMessage: string,
  elapsedMs: number,
): { errorClass: string; errorMessage: string } {
  const message = sanitizeDatabaseErrorMessage(rawMessage);
  const lower = message.toLowerCase();

  if (elapsedMs >= 7500 || /timed?\s*out|timeout|etimedout/.test(lower)) {
    return { errorClass: "TIMEOUT", errorMessage: message };
  }
  if (/econnrefused|connection refused|network is unreachable|enotfound|dns/.test(lower)) {
    return { errorClass: "NETWORK", errorMessage: message };
  }
  if (/password authentication|invalid authorization|28p01|role .* does not exist/.test(lower)) {
    return { errorClass: "AUTH", errorMessage: message };
  }
  if (/ssl|tls|certificate|handshake/.test(lower)) {
    return { errorClass: "SSL", errorMessage: message };
  }
  if (/syntax|invalid uri|parse/.test(lower)) {
    return { errorClass: "PARSE", errorMessage: message };
  }
  return { errorClass: "UNKNOWN", errorMessage: message };
}

function detectPasswordEncodingSuspect(raw: string): boolean {
  const body = raw.replace(/^postgres(?:ql)?:\/\//i, "");
  const atCount = (body.match(/@/g) ?? []).length;
  return atCount > 1;
}

export function parseDatabaseTargetSafe(raw: string | undefined): ParsedDatabaseTarget {
  const bindingSource = resolveDatabaseUrlBindingSource();
  const trimmed = typeof raw === "string" ? raw.trim() : "";

  const base: ParsedDatabaseTarget = {
    configured: Boolean(trimmed),
    bindingSource,
    host: null,
    port: null,
    database: null,
    usernamePrefix: null,
    projectRef: null,
    sslEnabled: false,
    isPoolerHost: false,
    isTransactionPoolerPort: false,
    passwordPresent: false,
    passwordEncodingSuspect: false,
    expectsPoolerHost: true,
    expectsTransactionPort: true,
    expectsProjectRef: true,
    parseError: null,
  };

  if (!trimmed) return base;

  base.passwordEncodingSuspect = detectPasswordEncodingSuspect(trimmed);

  try {
    const parsed = new URL(trimmed.replace(/^postgresql:/i, "postgres:"));
    const host = parsed.hostname;
    const port = parsed.port || "5432";
    const database = parsed.pathname.replace(/^\//, "") || "postgres";
    const username = decodeURIComponent(parsed.username || "");
    const password = parsed.password;

    base.host = host;
    base.port = port;
    base.database = database;
    base.passwordPresent = Boolean(password && password.length > 0);
    base.isPoolerHost = host.includes("pooler.supabase.com");
    base.isTransactionPoolerPort = port === "6543";
    base.sslEnabled =
      trimmed.toLowerCase().includes("sslmode=require") ||
      trimmed.toLowerCase().includes("sslmode=no-verify") ||
      host.includes("supabase") ||
      host.includes("pooler.");

    if (username) {
      const dot = username.indexOf(".");
      if (dot > 0) {
        base.usernamePrefix = `${username.slice(0, dot)}.`;
        base.projectRef = username.slice(dot + 1);
      } else {
        base.usernamePrefix = username.length > 12 ? `${username.slice(0, 12)}` : username;
        base.projectRef = null;
      }
    }
  } catch {
    base.parseError = "DATABASE_URL is not a valid URL";
  }

  return base;
}

export function evaluatePoolerExpectations(target: ParsedDatabaseTarget): string[] {
  const issues: string[] = [];
  if (!target.configured) {
    issues.push("DATABASE_URL is not set on the Worker");
    return issues;
  }
  if (target.parseError) {
    issues.push(target.parseError);
    return issues;
  }
  if (target.passwordEncodingSuspect) {
    issues.push("Password may contain unencoded special characters (@ : / ? #) — URL-encode the password");
  }
  if (target.host && /\.supabase\.co$/i.test(target.host) && !target.isPoolerHost) {
    issues.push(
      "Host is direct Supabase (db.<ref>.supabase.co) — Cloudflare Workers require the transaction pooler (*.pooler.supabase.com:6543)",
    );
  }
  if (!target.isPoolerHost) {
    issues.push("Host is not a pooler.supabase.com hostname");
  }
  if (!target.isTransactionPoolerPort && target.isPoolerHost && target.port === "5432") {
    issues.push(
      "Port is 5432 (session pooler) — Worker runtime upgrades to 6543; prefer transaction pooler :6543 in the secret",
    );
  } else if (!target.isTransactionPoolerPort) {
    issues.push(`Port is ${target.port ?? "unknown"} — transaction pooler requires 6543`);
  }
  if (target.projectRef !== EXPECTED_PROJECT_REF) {
    issues.push(
      `Username project ref is ${target.projectRef ?? "missing"} — expected postgres.${EXPECTED_PROJECT_REF}`,
    );
  }
  if (!target.sslEnabled) {
    issues.push("SSL not indicated — add sslmode=require for Supabase pooler");
  }
  if (!target.passwordPresent) {
    issues.push("Password segment missing from DATABASE_URL");
  }
  return issues;
}

/** Safe snapshot for health/diagnostic responses — never includes secrets. */
export function buildSafeDatabaseTargetSnapshot(raw: string | undefined): {
  bindingSource: DatabaseUrlBindingSource;
  host: string | null;
  port: string | null;
  database: string | null;
  usernamePrefix: string | null;
  sslEnabled: boolean;
  isPoolerHost: boolean;
  isTransactionPoolerPort: boolean;
  passwordPresent: boolean;
  configurationIssues: string[];
} {
  const parsed = parseDatabaseTargetSafe(raw);
  return {
    bindingSource: parsed.bindingSource,
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
    usernamePrefix: parsed.usernamePrefix,
    sslEnabled: parsed.sslEnabled,
    isPoolerHost: parsed.isPoolerHost,
    isTransactionPoolerPort: parsed.isTransactionPoolerPort,
    passwordPresent: parsed.passwordPresent,
    configurationIssues: evaluatePoolerExpectations(parsed),
  };
}
