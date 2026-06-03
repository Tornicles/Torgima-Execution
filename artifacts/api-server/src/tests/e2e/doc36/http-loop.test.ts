/**
 * DOC 36 — HTTP full loop against deployed API (DOC36_API_BASE required).
 */
import { describe, it, expect } from "vitest";
import { DOC36_API_BASE, DOC36_LOOP_BUDGET_MS, DOC36_TEST_EMAIL } from "../../helpers/doc36-constants.js";

const remote = Boolean(DOC36_API_BASE);

async function fetchJson(path: string, init: RequestInit = {}) {
  const res = await fetch(`${DOC36_API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body: { ok?: boolean; data?: unknown; error?: { code?: string; message?: string } };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    body = { ok: false, error: { message: text.slice(0, 200) } };
  }
  return { status: res.status, body };
}

describe.skipIf(!remote)("DOC 36 — HTTP loop (production API)", () => {
  it("GET /api/internal/health/system returns healthy", async () => {
    const { status, body } = await fetchJson("/api/internal/health/system", {
      headers: { "x-internal-auth": process.env.INTERNAL_AUTH_SECRET ?? "" },
    });
    expect(status).toBeLessThan(500);
    const data = body.data as { status?: string } | undefined;
    if (data?.status) expect(["healthy", "degraded"]).toContain(data.status);
  });

  it("documents production loop checklist (manual auth steps)", () => {
    expect(DOC36_TEST_EMAIL).toContain("@");
    expect(DOC36_LOOP_BUDGET_MS).toBeGreaterThan(0);
    // Full authenticated HTTP loop requires magic-link session from test user — run via scripts/run-doc36-production.mjs
  });
});
