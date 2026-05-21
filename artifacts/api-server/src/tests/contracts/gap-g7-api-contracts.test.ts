/**
 * GAP PROMPT G7 — API contract enforcement tests.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  orderFeedbackResponseSchema,
  executionFeedbackResponseSchema,
  executionActiveOrderResponseSchema,
  apiSuccessEnvelopeSchema,
} from "../../contracts/responseSchemas.js";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
);
const torgimaSrc = path.resolve(workspaceRoot, "artifacts/torgima/src");
const apiSpecDir = path.resolve(workspaceRoot, "lib/api-spec");
const generatedApi = path.resolve(
  workspaceRoot,
  "lib/api-client-react/src/generated/api.ts",
);

function listTsFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) listTsFiles(p, acc);
    else if (/\.(tsx?)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

describe("GAP G7 — contract schemas", () => {
  it("T3: order feedback response matches contract", () => {
    const body = {
      ok: true,
      data: {
        feedbackId: "550e8400-e29b-41d4-a716-446655440000",
        verdictStatus: "accepted",
        weightedScore: 8.1,
        confidence: "high",
        requiresInterrogation: false,
        eventId: "evt-1",
      },
      meta: { timestamp: new Date().toISOString() },
    };
    const parsed = orderFeedbackResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
  });

  it("T4: contract test fails when feedback_id renamed to id", () => {
    const broken = {
      ok: true,
      data: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        verdictStatus: "accepted",
        weightedScore: 8.1,
        confidence: "high",
        requiresInterrogation: false,
        eventId: "evt-1",
      },
    };
    const parsed = orderFeedbackResponseSchema.safeParse(broken);
    expect(parsed.success).toBe(false);
  });

  it("execution feedback contract accepts primary loop fields", () => {
    const body = {
      ok: true,
      data: {
        feedbackId: "550e8400-e29b-41d4-a716-446655440000",
        queued: true,
        nextOrderId: "550e8400-e29b-41d4-a716-446655440001",
        requiresInterrogation: false,
      },
    };
    expect(executionFeedbackResponseSchema.safeParse(body).success).toBe(true);
  });

  it("active-order contract requires order.id", () => {
    const ok = {
      ok: true,
      data: {
        order: { id: "550e8400-e29b-41d4-a716-446655440000", title: "Task" },
      },
    };
    expect(executionActiveOrderResponseSchema.safeParse(ok).success).toBe(true);

    const bad = { ok: true, data: { order: { title: "no id" } } };
    expect(executionActiveOrderResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("api envelope rejects ok:false", () => {
    expect(apiSuccessEnvelopeSchema.safeParse({ ok: false }).success).toBe(false);
  });
});

describe("GAP G7 — OpenAPI artifact", () => {
  it("T1: swagger.json exists after generate script", () => {
    const swagger = path.join(apiSpecDir, "dist/swagger.json");
    const openapi = path.join(apiSpecDir, "openapi.yaml");
    expect(fs.existsSync(openapi)).toBe(true);
    expect(fs.existsSync(swagger)).toBe(true);
    const text = fs.readFileSync(swagger, "utf8");
    expect(text).toContain("/execution/active-order");
    expect(text).toContain("/orders/{id}/feedback");
  });

  it("routes manifest lists live Express routes", () => {
    const manifest = path.join(apiSpecDir, "routes.manifest.json");
    if (!fs.existsSync(manifest)) return;
    const data = JSON.parse(fs.readFileSync(manifest, "utf8")) as { routeCount: number };
    expect(data.routeCount).toBeGreaterThan(20);
  });
});

describe("GAP G7 — frontend manual fetch ban", () => {
  it("T2: no fetch('/api...') in torgima src", () => {
    const files = listTsFiles(torgimaSrc);
    const violations: string[] = [];
    const re = /fetch\s*\([^)]*\/api\//;

    for (const file of files) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i]!)) {
          violations.push(`${path.relative(torgimaSrc, file)}:${i + 1}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

describe("GAP G7 — generated client surface", () => {
  it("T5: generated client exports critical operations", () => {
    expect(fs.existsSync(generatedApi)).toBe(true);
    const src = fs.readFileSync(generatedApi, "utf8");
    expect(src).toContain("export const getDashboardState");
    expect(src).toContain("export const getOrder");
    expect(src).toContain("export const submitOnboardingGoal");
    expect(src).toContain("export const getExecutionActiveOrder");
    expect(src).toContain("export const submitExecutionFeedback");
  });
});
