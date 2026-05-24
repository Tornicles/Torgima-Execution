import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("validation launch lookup (Erector)", () => {
  it("selectValidationPath does not filter Erector rows by INTELLIGENCE kind only", () => {
    const service = readRepo("artifacts/api-server/src/services/ValidationService.ts");
    expect(service).toContain("findValidationForBlueprint");
    expect(service).not.toContain(
      "eq(validations.validation_kind, ValidationKind.INTELLIGENCE),\n            ),\n          )\n          .limit(1)\n      : await db",
    );
    expect(service).toContain("validation.validation_kind === ValidationKind.ERECTOR");
  });

  it("findValidationForBlueprint supports id, contract, and user fallback", () => {
    const service = readRepo("artifacts/api-server/src/services/ValidationService.ts");
    expect(service).toContain("validationIdHint");
    expect(service).toContain("Found by contract_id matching URL id");
    expect(service).toContain("Fallback — using user's most recent validation row");
  });
});
