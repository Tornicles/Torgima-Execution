/**
 * Blueprint tier system — select-tier launch wiring and optional DB integration.
 * DB tests: TORGIMA_INTEGRATION=true + DATABASE_URL (not vitest_stub).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, afterAll } from "vitest";
import {
  DOC29_KEY_API_ROUTES,
} from "../../../lib/doc29-route-inventory.js";
import { db, validations, blueprints, blueprintTierPreviews, plans } from "@workspace/db";
import { eq } from "drizzle-orm";
import { BlueprintStatus } from "@workspace/state-machine";
import { integrationEnabled, createTestUser, cleanupTestUser } from "../../helpers/db.js";
import { ensureTierPreviewsPresent } from "../../../lib/ensureTierPreviews.js";
import { BlueprintTierLaunchService } from "../../../services/BlueprintTierLaunchService.js";
import { transitionBlueprintToPathSelection } from "../../../lib/transitionBlueprintToPathSelection.js";
import { getTierConfig } from "../../../engines/blueprint/TierConfig.js";

const root = resolve(process.cwd(), "../..");
const readRepo = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const runDb = integrationEnabled();

describe("Blueprint tier select-and-launch", () => {
  describe("API wiring contracts", () => {
    it("registers select-tier and tier-preview routes", () => {
      const routes = readRepo("artifacts/api-server/src/routes/blueprints.ts");
      expect(routes).toContain('router.post("/blueprints/select-tier"');
      expect(routes).toContain('router.get("/blueprints/:id/tier-preview"');
      expect(routes).toContain("ValidationLaunchService.launch");
    });

    it("ValidationLaunchService delegates chain generation to tier launch service", () => {
      const svc = readRepo("artifacts/api-server/src/services/ValidationLaunchService.ts");
      expect(svc).toContain("BlueprintTierLaunchService.selectTierAndLaunch");
    });

    it("onboarding select-blueprint is not duplicated on validation router", () => {
      const validation = readRepo("artifacts/api-server/src/routes/validation.ts");
      expect(validation).not.toContain("selectBlueprintLaunchHandler");
    });

    it("path_selection transition builds tier previews", () => {
      const transition = readRepo("artifacts/api-server/src/lib/transitionBlueprintToPathSelection.ts");
      expect(transition).toContain("ensureTierPreviewsPresent");
    });

    it("OpenAPI health manifest lists tier endpoints", () => {
      expect(DOC29_KEY_API_ROUTES).toContain("POST /api/blueprints/select-tier");
      const health = readRepo("artifacts/api-server/src/routes/health.ts");
      expect(health).toContain("DOC29_KEY_API_ROUTES");
      expect(health).toContain("GET /api/blueprints/:id/tier-preview");
    });
  });

  describe.skipIf(!runDb)("database — previews and starter launch", () => {
    let userId = "";
    let blueprintId = "";
    let validationId = "";

    afterAll(async () => {
      if (userId) await cleanupTestUser(userId);
    });

    it("ensureTierPreviewsPresent sets tier_presented and three cards", async () => {
      const user = await createTestUser({ tier: "growth" });
      userId = user.id;

      const [bp] = await db
        .insert(blueprints)
        .values({
          user_id: userId,
          goal: "Launch a SaaS with 50 paying customers in 90 days",
          raw_goal: "Launch a SaaS with 50 paying customers in 90 days",
          purpose: "Build recurring revenue",
          purpose_final: "Build recurring revenue",
          goal_final: "Launch a SaaS with 50 paying customers in 90 days",
          timeframe_days: 90,
          commitment_level: "medium",
          tier: "starter",
          mode: "individual",
          status: BlueprintStatus.PATH_SELECTION,
          active: false,
          state_version: 1,
        })
        .returning();
      if (!bp) throw new Error("blueprint insert failed");
      blueprintId = bp.id;

      const [val] = await db
        .insert(validations)
        .values({
          blueprint_id: blueprintId,
          user_id: userId,
          status: "complete",
          verdict: "adjust",
          feasibility_score: 72,
          clarity_score: 68,
          realism_score: 65,
          goal_final: bp.goal_final,
          purpose_final: bp.purpose_final,
          tier_flow_status: "pending",
        })
        .returning();
      if (!val) throw new Error("validation insert failed");
      validationId = val.id;

      await transitionBlueprintToPathSelection({
        blueprintId,
        userId,
        validationId,
        verdict: "adjust",
        selectedPath: "adjusted",
        realityScore: 65,
        validationKind: "erector",
      });

      const cards = await ensureTierPreviewsPresent(validationId, userId);
      expect(cards.length).toBe(3);

      const [flow] = await db
        .select({ tier_flow_status: validations.tier_flow_status })
        .from(validations)
        .where(eq(validations.id, validationId))
        .limit(1);
      expect(flow?.tier_flow_status).toBe("tier_presented");

      const previewRows = await db
        .select()
        .from(blueprintTierPreviews)
        .where(eq(blueprintTierPreviews.validation_id, validationId));
      expect(previewRows.length).toBe(3);
    });

    it("selectTierAndLaunch generates starter chain and activates blueprint", async () => {
      expect(blueprintId).toBeTruthy();
      expect(validationId).toBeTruthy();

      const result = await BlueprintTierLaunchService.selectTierAndLaunch({
        blueprintId,
        userId,
        validationId,
        selectedTier: "starter",
        selectedPath: "adjusted",
      });

      expect(result.launched).toBe(true);
      expect(result.tier).toBe("starter");
      expect(result.redirectTo).toBe("/dashboard");

      const starterPlans = getTierConfig("starter").plans.length;
      expect(result.generationSummary?.plansCreated).toBe(starterPlans);

      const [bp] = await db
        .select({ status: blueprints.status, active: blueprints.active, tier_config: blueprints.tier_config })
        .from(blueprints)
        .where(eq(blueprints.id, blueprintId))
        .limit(1);
      expect(bp?.status).toBe(BlueprintStatus.ACTIVE);
      expect(bp?.active).toBe(true);
      expect(bp?.tier_config).toBeTruthy();

      const planRows = await db
        .select({ id: plans.id })
        .from(plans)
        .where(eq(plans.blueprint_id, blueprintId));
      expect(planRows.length).toBe(starterPlans);

      const [val] = await db
        .select({ tier_flow_status: validations.tier_flow_status })
        .from(validations)
        .where(eq(validations.id, validationId))
        .limit(1);
      expect(val?.tier_flow_status).toBe("launched");
    }, 120_000);
  });
});
