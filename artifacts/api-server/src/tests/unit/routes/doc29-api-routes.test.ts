/**
 * DOC29 — Complete API route inventory verification.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DOC29_KEY_API_ROUTES,
  DOC29_INTERNAL_ENGINE_ROUTES,
} from "../../../lib/doc29-route-inventory.js";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

function countRouteHandlers(routesDir: string): number {
  let count = 0;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".ts")) continue;
      const src = readFileSync(full, "utf8");
      const matches = src.match(/router\.(get|post|put|patch|delete)\(/g);
      if (matches) count += matches.length;
    }
  };
  walk(routesDir);
  return count;
}

describe("api-routes", () => {
  it("mounts doc29 router in routes index", () => {
    const index = readRepo("artifacts/api-server/src/routes/index.ts");
    expect(index).toContain("doc29-routes");
    expect(index).toContain("doc29Router");
  });

  it("registers canonical onboarding and launch routes", () => {
    const onboarding = readRepo("artifacts/api-server/src/routes/onboarding.ts");
    expect(onboarding).toContain('router.post("/onboarding/select-blueprint"');
    const blueprints = readRepo("artifacts/api-server/src/routes/blueprints.ts");
    expect(blueprints).toContain('router.post("/blueprints/:id/activate"');
    expect(blueprints).toContain('router.post("/blueprints/select-tier"');
  });

  it("registers DOC29 intelligence and state routes", () => {
    const doc29 = readRepo("artifacts/api-server/src/routes/doc29-routes.ts");
    expect(doc29).toContain('router.get("/state/current"');
    expect(doc29).toContain('router.get("/cognitive-load/current"');
    expect(doc29).toContain('router.get("/patterns/current"');
    expect(doc29).toContain('router.get("/friction/current"');
    expect(doc29).toContain('router.get("/failures/current"');
    expect(doc29).toContain('router.get("/priority/current"');
    expect(doc29).toContain('router.get("/dependencies/current"');
    expect(doc29).toContain('router.get("/decisions/history"');
    expect(doc29).toContain('router.post("/uploads/proof"');
    expect(doc29).toContain('router.post("/feedback/:id/clarify"');
  });

  it("registers DOC29 outcome and reward read routes", () => {
    const engagement = readRepo("artifacts/api-server/src/routes/engagement.ts");
    expect(engagement).toContain('router.get("/rewards/current"');
    expect(engagement).toContain('router.get("/outcomes/current"');
    expect(engagement).toContain('router.post("/outcomes/:id/evidence"');
  });

  it("registers DOC29 auth aliases", () => {
    const auth = readRepo("artifacts/api-server/src/routes/auth.ts");
    expect(auth).toContain('router.post("/login"');
    expect(auth).toContain('router.get("/verify"');
    expect(auth).toContain('router.get("/session"');
  });

  it("registers DOC29 internal engine worker routes", () => {
    const internal = readRepo("artifacts/api-server/src/routes/internal.ts");
    for (const route of DOC29_INTERNAL_ENGINE_ROUTES) {
      const path = route.replace(/^(GET|POST) \/api/, "");
      expect(internal).toContain(`"${path}"`);
    }
  });

  it("rejects browser-origin internal calls in auth layer", () => {
    const auth = readRepo("artifacts/api-server/src/lib/auth.ts");
    expect(auth).toContain("BROWSER_INTERNAL_ROUTE_ATTEMPT");
    expect(auth).toContain('throw new TorgimaError("FORBIDDEN", "Internal route not accessible from browser")');
  });

  it("applies DOC29 rate limit tiers", () => {
    const limits = readRepo("artifacts/api-server/src/middleware/apiRateLimit.ts");
    expect(limits).toContain('prefix: "/api/feedback"');
    expect(limits).toContain("max: 30");
    expect(limits).toContain('prefix: "/api/uploads"');
    expect(limits).toContain("60 * 60_000");
    expect(limits).toContain("120, 60_000");

    const bhudhi = readRepo("artifacts/api-server/src/middleware/bhudhiRateLimit.ts");
    expect(bhudhi).toContain("10, 60_000");
  });

  it("lists DOC29 routes in health manifest", () => {
    const health = readRepo("artifacts/api-server/src/routes/health.ts");
    expect(health).toContain("DOC29_KEY_API_ROUTES");
    expect(health).toContain("POST /api/v1/onboarding/select-blueprint");
    expect(DOC29_KEY_API_ROUTES).toContain("GET /api/state/current");
    expect(DOC29_KEY_API_ROUTES).toContain("POST /api/auth/login");
    expect(DOC29_INTERNAL_ENGINE_ROUTES.length).toBeGreaterThan(0);
  });

  it("route inventory meets DOC29 minimum (>= 60 canonical routes)", () => {
    expect(DOC29_KEY_API_ROUTES.length).toBeGreaterThanOrEqual(40);
    const handlerCount = countRouteHandlers(
      resolve(root, "artifacts/api-server/src/routes"),
    );
    expect(handlerCount).toBeGreaterThanOrEqual(60);
  });

  it("standard error codes are defined", () => {
    const errors = readRepo("artifacts/api-server/src/lib/errors.ts");
    expect(errors).toContain('"STALE_STATE"');
    expect(errors).toContain('"RATE_LIMITED"');
    expect(errors).toContain('"VALIDATION_ERROR"');
    expect(errors).toContain('"UNAUTHENTICATED"');
  });
});
