import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("DOC 29 API routes", () => {
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

  it("registers DOC 29 intelligence and state routes", () => {
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

  it("registers DOC 29 auth aliases", () => {
    const auth = readRepo("artifacts/api-server/src/routes/auth.ts");
    expect(auth).toContain('router.post("/login"');
    expect(auth).toContain('router.get("/verify"');
  });

  it("lists DOC 29 routes in health manifest", () => {
    const health = readRepo("artifacts/api-server/src/routes/health.ts");
    expect(health).toContain("POST /api/onboarding/select-blueprint");
    expect(health).toContain("GET /api/state/current");
    expect(health).toContain("POST /api/auth/login");
  });
});
