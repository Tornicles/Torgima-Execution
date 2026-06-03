import { db, blueprintTierPreviews, validations } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { BlueprintStatus } from "@workspace/state-machine";
import { TorgimaError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { ensureTierPreviewsPresent } from "../lib/ensureTierPreviews.js";
import { BlueprintService } from "./BlueprintService.js";
import { BlueprintLaunchService } from "./BlueprintLaunchService.js";
import { BlueprintGenerationEngine } from "../engines/blueprint/BlueprintGenerationEngine.js";

export type TierLaunchPath = "current" | "adjusted" | "alternative";
export type TierLaunchLevel = "starter" | "growth" | "ultimate";

export type BlueprintTierLaunchInput = {
  blueprintId: string;
  validationId: string;
  userId: string;
  selectedTier: TierLaunchLevel;
  selectedPath: TierLaunchPath;
};

export type BlueprintTierLaunchResult = {
  blueprintId: string;
  tier: TierLaunchLevel;
  redirectTo: string;
  launched: true;
  generationSummary?: {
    plansCreated: number;
    seasonsCreated: number;
    targetsCreated: number;
    phasesCreated: number;
    actionsCreated: number;
    durationMs: number;
  };
};

export const BlueprintTierLaunchService = {
  async selectTierAndLaunch(input: BlueprintTierLaunchInput): Promise<BlueprintTierLaunchResult> {
    const bp = await BlueprintService.get(input.blueprintId, input.userId);
    if (bp.status !== BlueprintStatus.PATH_SELECTION) {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        `Blueprint must be in path_selection (status=${bp.status})`,
        false,
      );
    }

    const [validation] = await db
      .select()
      .from(validations)
      .where(
        and(eq(validations.id, input.validationId), eq(validations.user_id, input.userId)),
      )
      .limit(1);

    if (!validation || validation.blueprint_id !== input.blueprintId) {
      throw new TorgimaError("NOT_FOUND", "Validation not found", false);
    }

    if (validation.verdict === "pivot") {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Cannot launch when validation verdict is pivot — adjust your direction first",
        false,
      );
    }

    await ensureTierPreviewsPresent(input.validationId, input.userId);

    const [flowRow] = await db
      .select({ tier_flow_status: validations.tier_flow_status })
      .from(validations)
      .where(eq(validations.id, input.validationId))
      .limit(1);

    const flowStatus = flowRow?.tier_flow_status ?? "pending";
    if (flowStatus !== "tier_presented" && flowStatus !== "tier_selected") {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        `Complete validation and tier previews first (tier_flow_status=${flowStatus})`,
        false,
      );
    }

    if (!validation.contract_id) {
      throw new TorgimaError("VALIDATION_ERROR", "Validation contract missing", false);
    }

    const now = new Date();
    await db
      .update(validations)
      .set({
        selected_blueprint_tier: input.selectedTier,
        selected_path: input.selectedPath,
        selected_path_type: input.selectedPath,
        tier_flow_status: "tier_selected",
        tier_selected_at: now,
      })
      .where(eq(validations.id, input.validationId));

    await db
      .update(blueprintTierPreviews)
      .set({ selected: false })
      .where(eq(blueprintTierPreviews.validation_id, input.validationId));
    await db
      .update(blueprintTierPreviews)
      .set({ selected: true })
      .where(
        and(
          eq(blueprintTierPreviews.validation_id, input.validationId),
          eq(blueprintTierPreviews.tier, input.selectedTier),
        ),
      );

    logger.info(
      {
        blueprintId: input.blueprintId,
        validationId: input.validationId,
        tier: input.selectedTier,
        path: input.selectedPath,
      },
      "[TierLaunch] Generating tier chain and activating blueprint",
    );

    const result = await BlueprintGenerationEngine.generate({
      blueprintId: input.blueprintId,
      userId: input.userId,
      validationId: input.validationId,
      selectedTier: input.selectedTier,
      selectedPath: input.selectedPath,
      launchAfterGenerate: false,
    });

    await BlueprintLaunchService.launch({
      blueprintId: input.blueprintId,
      userId: input.userId,
      validationContractId: validation.contract_id,
      selectedPathType: input.selectedPath,
      selectedBlueprintLevel: input.selectedTier,
    });

    await db
      .update(validations)
      .set({ tier_flow_status: "launched" })
      .where(eq(validations.id, input.validationId));

    return {
      blueprintId: result.blueprintId,
      tier: input.selectedTier,
      redirectTo: "/dashboard",
      launched: true,
      generationSummary: result.generationSummary,
    };
  },
};
