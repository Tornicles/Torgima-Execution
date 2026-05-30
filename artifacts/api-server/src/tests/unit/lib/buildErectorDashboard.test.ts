import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Erector dashboard API wiring", () => {
  it("registers GET /api/erector/dashboard and returns panels envelope", () => {
    const route = readRepo("artifacts/api-server/src/routes/erector-dashboard.ts");
    expect(route).toContain('/erector/dashboard');
    expect(route).toContain("buildErectorDashboard");
    expect(route).toContain("success(res, { panels })");

    const index = readRepo("artifacts/api-server/src/routes/index.ts");
    expect(index).toContain("erector-dashboard.js");
  });

  it("frontend fetches /api/erector/dashboard panels", () => {
    const api = readRepo("artifacts/torgima/src/lib/erector-dashboard-api.ts");
    expect(api).toContain("/api/erector/dashboard");
    expect(api).toContain("data.panels");
  });
});
