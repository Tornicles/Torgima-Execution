#!/usr/bin/env node
/**
 * Fail CI when DATABASE_URL is not a Supabase transaction pooler URL.
 * Cloudflare Workers cannot reach direct db.<ref>.supabase.co:5432 reliably.
 */

const EXPECTED_PROJECT_REF = "fmynbziciuadnvjlojub";

function validateDatabaseUrl(raw) {
  const issues = [];
  const trimmed = typeof raw === "string" ? raw.trim() : "";

  if (!trimmed) {
    issues.push("DATABASE_URL is empty or not set");
    return issues;
  }

  if (/@.*@/.test(trimmed.replace(/^postgres(?:ql)?:\/\//i, ""))) {
    issues.push("Password may contain unencoded special characters — URL-encode the password");
  }

  let parsed;
  try {
    parsed = new URL(trimmed.replace(/^postgresql:/i, "postgres:"));
  } catch {
    issues.push("DATABASE_URL is not a valid URL");
    return issues;
  }

  const host = parsed.hostname;
  const port = parsed.port || "5432";
  const username = decodeURIComponent(parsed.username || "");
  const password = parsed.password;

  if (/\.supabase\.co$/i.test(host) && !host.includes("pooler.")) {
    issues.push(
      `Host is direct Supabase (${host}) — use transaction pooler aws-0-<region>.pooler.supabase.com:6543`,
    );
  }
  if (!host.includes("pooler.supabase.com")) {
    issues.push(`Host must be *.pooler.supabase.com (got ${host})`);
  }
  if (port !== "6543") {
    issues.push(`Port must be 6543 for transaction pooler (got ${port})`);
  }

  const dot = username.indexOf(".");
  const projectRef = dot > 0 ? username.slice(dot + 1) : null;
  if (projectRef !== EXPECTED_PROJECT_REF) {
    issues.push(
      `Username must be postgres.${EXPECTED_PROJECT_REF} (got ${username || "missing"})`,
    );
  }
  if (!password) {
    issues.push("Password segment missing from DATABASE_URL");
  }

  const lower = trimmed.toLowerCase();
  if (
    !lower.includes("sslmode=require") &&
    !lower.includes("sslmode=no-verify") &&
    !host.includes("pooler.")
  ) {
    issues.push("Add sslmode=require for Supabase pooler connections");
  }

  return issues;
}

const url = process.env.DATABASE_URL;
const issues = validateDatabaseUrl(url);

if (issues.length > 0) {
  console.error("DATABASE_URL validation failed for Cloudflare Worker deploy:\n");
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  console.error(
    "\nFix GitHub secret DATABASE_URL to the Supabase transaction pooler URL, then redeploy.",
  );
  process.exit(1);
}

console.log("DATABASE_URL OK for Cloudflare Worker (Supabase transaction pooler)");
