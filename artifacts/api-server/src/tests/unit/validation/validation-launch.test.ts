import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validationLaunchBodySchema } from "../../../routes/validation.js";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("validation launch route", () => {
  it("accepts selected_direction with path, tier, and mode", () => {
    const parsed = validationLaunchBodySchema.safeParse({
      selected_direction: {
        path: "adjusted",
        tier: "growth",
        mode: "individual",
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.selected_direction?.path).toBe("adjusted");
      expect(parsed.data.selected_direction?.tier).toBe("growth");
    }
  });

  it("registers canonical POST /api/v1/validations/:id/launch", () => {
    const routes = readRepo("artifacts/api-server/src/routes/validation.ts");
    expect(routes).toContain('router.post("/v1/validations/:id/launch"');
    expect(routes).toContain("ValidationLaunchService");
  });

  it("accepts blueprintTier and blueprintId in launch body", () => {
    const parsed = validationLaunchBodySchema.safeParse({
      blueprintTier: "growth",
      blueprintId: "550e8400-e29b-41d4-a716-446655440000",
      selectedPath: "adjusted",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.blueprintTier).toBe("growth");
      expect(parsed.data.blueprintId).toBe("550e8400-e29b-41d4-a716-446655440000");
    }
  });

  it("validation results page routes to tier selection before launch", () => {
    const results = readRepo("artifacts/torgima/src/pages/validation-results.tsx");
    expect(results).toContain("/onboarding/select-blueprint");
    expect(results).not.toContain("launchValidationBlueprint");
  });

  it("select-blueprint page launches blueprint with tier", () => {
    const page = readRepo("artifacts/torgima/src/pages/onboarding/select-blueprint.tsx");
    expect(page).toContain("launchValidationBlueprint");
    expect(page).toContain("finalizeValidationBlueprint");
    expect(page).toContain("blueprintTier");
  });

  it("torgima-api exposes launchValidationBlueprint helper", () => {
    const api = readRepo("artifacts/torgima/src/lib/torgima-api.ts");
    expect(api).toContain("launchValidationBlueprint");
    expect(api).toContain("/api/v1/validations/");
    expect(api).toContain("selected_direction");
  });
});
