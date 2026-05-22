/**
 * Prompt 9 — all 10 Erector fixtures seed without errors.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  ERECTOR_FIXTURE_NAMES,
  seedErectorFixture,
  cleanupErectorFixture,
} from "./erector-fixtures.js";
import { integrationEnabled } from "../helpers/db.js";

const run = integrationEnabled();

describe.skipIf(!run)("Erector fixtures — database seeds", () => {
  const cleanups: string[] = [];

  afterEach(async () => {
    for (const userId of cleanups.splice(0)) {
      await cleanupErectorFixture(userId);
    }
  });

  it.each([...ERECTOR_FIXTURE_NAMES])(
    "seeds %s",
    async (name) => {
      const fx = await seedErectorFixture(name);
      cleanups.push(fx.userId);
      expect(fx.validationId).toBeTruthy();
      expect(fx.blueprintId).toBeTruthy();
      expect(fx.validationContractId).toBeTruthy();
    },
    60_000,
  );
});
