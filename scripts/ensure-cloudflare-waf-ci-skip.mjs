#!/usr/bin/env node
/**
 * Ensure Cloudflare WAF skips managed challenge for GitHub Actions CI health probes.
 * Idempotent — safe to run from CI or locally.
 *
 * Requires:
 *   CLOUDFLARE_API_TOKEN (Zone.Firewall Services Edit or Zone.WAF Edit)
 *   CLOUDFLARE_ZONE_ID (optional — resolved from CLOUDFLARE_ZONE_NAME)
 *
 * Usage:
 *   pnpm run ensure:cloudflare:waf-ci-skip
 *   pnpm run ensure:cloudflare:waf-ci-skip -- --soft   # warn only on failure
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const softFlag = process.argv.includes("--soft");

const ZONE_NAME = process.env.CLOUDFLARE_ZONE_NAME?.trim() || "torgima.com";
const RULE_DESCRIPTION = "TORGIMA: allow GitHub Actions CI health probe";
const RULE_EXPRESSION =
  '(http.host eq "api.torgima.com" and http.request.uri.path eq "/health" and http.user_agent eq "GitHubActions-CI")';
const PHASE = "http_request_firewall_custom";

const CI_SKIP_RULE = {
  description: RULE_DESCRIPTION,
  expression: RULE_EXPRESSION,
  action: "skip",
  action_parameters: {
    phases: ["http_request_sbfm", "http_ratelimit", "http_request_firewall_managed"],
  },
  enabled: true,
};

function log(msg) {
  console.log(`[waf] ${msg}`);
}

function warn(msg) {
  console.warn(`[waf] ${msg}`);
}

function fail(msg, code = 1) {
  if (softFlag) {
    warn(`${msg} — continuing (--soft)`);
    process.exit(0);
  }
  console.error(`[waf] ${msg}`);
  process.exit(code);
}

async function cfFetch(path, options = {}) {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) {
    fail("Missing CLOUDFLARE_API_TOKEN");
  }

  const url = `https://api.cloudflare.com/client/v4${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function resolveZoneId() {
  const explicit = process.env.CLOUDFLARE_ZONE_ID?.trim();
  if (explicit) return explicit;

  const { res, body } = await cfFetch(`/zones?name=${encodeURIComponent(ZONE_NAME)}`);
  if (!res.ok || !body.success) {
    fail(`Could not resolve zone for ${ZONE_NAME}: ${body.errors?.[0]?.message ?? res.status}`);
  }

  const zone = body.result?.[0];
  if (!zone?.id) {
    fail(`Zone not found: ${ZONE_NAME}`);
  }

  log(`Resolved zone ${ZONE_NAME} → ${zone.id}`);
  return zone.id;
}

function ruleMatches(existing) {
  return (
    existing?.description === RULE_DESCRIPTION ||
    existing?.expression === RULE_EXPRESSION
  );
}

async function getEntrypointRuleset(zoneId) {
  const { res, body } = await cfFetch(`/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`);
  if (res.status === 404) return null;
  if (!res.ok || !body.success) {
    fail(`Failed to read ${PHASE} entrypoint: ${body.errors?.[0]?.message ?? res.status}`);
  }
  return body.result;
}

async function createEntrypointRuleset(zoneId) {
  const { res, body } = await cfFetch(`/zones/${zoneId}/rulesets`, {
    method: "POST",
    body: JSON.stringify({
      name: "TORGIMA custom firewall",
      kind: "zone",
      phase: PHASE,
      rules: [CI_SKIP_RULE],
    }),
  });

  if (!res.ok || !body.success) {
    fail(`Failed to create ${PHASE} ruleset: ${body.errors?.[0]?.message ?? res.status}`);
  }

  log("Created WAF skip rule for GitHub Actions CI health probe");
  return body.result;
}

async function updateEntrypointRuleset(zoneId, ruleset) {
  const existingRules = Array.isArray(ruleset.rules) ? ruleset.rules : [];
  const already = existingRules.find(ruleMatches);
  if (already) {
    log("WAF skip rule already present — no changes");
    return ruleset;
  }

  const nextRules = [
    CI_SKIP_RULE,
    ...existingRules.map((rule) => {
      const copy = { ...rule };
      if (copy.id) return copy;
      return copy;
    }),
  ];

  const { res, body } = await cfFetch(`/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`, {
    method: "PUT",
    body: JSON.stringify({ rules: nextRules }),
  });

  if (!res.ok || !body.success) {
    fail(`Failed to update ${PHASE} entrypoint: ${body.errors?.[0]?.message ?? res.status}`);
  }

  log("Added WAF skip rule for GitHub Actions CI health probe");
  return body.result;
}

async function main() {
  log(`Target zone: ${ZONE_NAME}`);
  log(`Rule: skip managed challenge when ${RULE_EXPRESSION}`);

  const zoneId = await resolveZoneId();
  const entrypoint = await getEntrypointRuleset(zoneId);

  if (!entrypoint) {
    await createEntrypointRuleset(zoneId);
  } else {
    await updateEntrypointRuleset(zoneId, entrypoint);
  }

  log("Done");
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
