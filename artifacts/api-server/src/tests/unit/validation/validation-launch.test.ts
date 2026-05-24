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

  it("onboarding calls launchValidationBlueprint with validations launch URL", () => {
    const onboarding = readRepo("artifacts/torgima/src/pages/onboarding.tsx");
    expect(onboarding).toContain("launchValidationBlueprint");
    expect(onboarding).toContain("/api/v1/validations/");
    expect(onboarding).toContain("Launching Blueprint");
  });

  it("torgima-api exposes launchValidationBlueprint helper", () => {
    const api = readRepo("artifacts/torgima/src/lib/torgima-api.ts");
    expect(api).toContain("launchValidationBlueprint");
    expect(api).toContain("/api/v1/validations/");
    expect(api).toContain("selected_direction");
  });
});
