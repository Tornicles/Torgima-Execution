/**
 * Blueprint Tier System — generates the full execution chain from TierConfig
 * before BlueprintEngine.launch() / activateBlueprint().
 */

import {
  blueprintGenerationLog,
  blueprints,
  db,
  plans,
  validations,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { TorgimaError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { BlueprintStatus } from "@workspace/state-machine";
import { writeEvent, EventTypes } from "../../services/EventService.js";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { BlueprintEngine } from "./BlueprintEngine.js";
import {
  buildChainFromTierConfig,
  clearBlueprintChain,
  type ChainBuildResult,
} from "./BlueprintChainGenerator.js";
import { getTierConfig, normalizeBlueprintTier, type TierConfig } from "./TierConfig.js";
import { intelligenceDepthForTier } from "./BlueprintRuleEngine.js";
import type { BlueprintTier } from "./infrastructure/blueprint-types.js";
import type { ValidationToBlueprintContract } from "../validation/intelligence/validation-intelligence-types.js";

export type GenerationPath = "current" | "adjusted" | "alternative";

export interface GenerationInput {
  blueprintId: string;
  userId: string;
  validationId: string;
  selectedTier: BlueprintTier;
  selectedPath: GenerationPath;
  /** When true, calls BlueprintEngine.launch after logging (default false — use BlueprintLaunchService for full stack). */
  launchAfterGenerate?: boolean;
}

export interface GenerationSummary {
  plansCreated: number;
  seasonsCreated: number;
  targetsCreated: number;
  phasesCreated: number;
  actionsCreated: number;
  durationMs: number;
  bhudhiUsed: boolean;
  fallbackUsed: boolean;
}

export interface GenerationOutput {
  blueprintId: string;
  tier: BlueprintTier;
  chain: ChainBuildResult;
  generationSummary: GenerationSummary;
  launched: boolean;
}

const blueprintEngine = new BlueprintEngine();
const BHUDHI_ENRICH_MS = 8_000;

function mapPolicyEnforcement(cfg: TierConfig): string {
  return cfg.policy_enforcement;
}

async function enrichNamesWithBhudhi(
  userId: string,
  blueprintId: string,
  facts: Record<string, unknown>,
): Promise<{ bhudhiUsed: boolean; fallbackUsed: boolean; bhudhiLogId?: string }> {
  try {
    const result = await Promise.race([
      routeBhudhiRequest({
        sourceEngine: "BLUEPRINT_GENERATION_ENGINE",
        triggerType: "BLUEPRINT_GENERATION",
        userId,
        blueprintId,
        stateVersion: 0,
        idempotencyKey: `tier_chain_gen:${blueprintId}:${Date.now()}`,
        facts,
        webSearchEnabled: false,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("bhudhi_timeout")), BHUDHI_ENRICH_MS);
      }),
    ]);
    if (!result.ok) {
      return { bhudhiUsed: false, fallbackUsed: true };
    }
    const data = result.output?.data as
      | { planLabels?: string[]; targetLabels?: string[] }
      | undefined;
    if (data?.planLabels?.length) {
      const planRows = await db
        .select({ id: plans.id })
        .from(plans)
        .where(eq(plans.blueprint_id, blueprintId))
        .orderBy(plans.order_index);
      for (let i = 0; i < planRows.length && i < data.planLabels.length; i++) {
        const label = data.planLabels[i];
        if (!label?.trim()) continue;
        await db
          .update(plans)
          .set({ name: label, title: label })
          .where(eq(plans.id, planRows[i]!.id));
      }
    }
    return {
      bhudhiUsed: true,
      fallbackUsed: Boolean(result.fallbackUsed),
      bhudhiLogId: result.logId || undefined,
    };
  } catch (err) {
    logger.debug(
      { blueprintId, err: err instanceof Error ? err.message : String(err) },
      "BlueprintGenerationEngine — Bhudhi enrich skipped",
    );
    return { bhudhiUsed: false, fallbackUsed: true };
  }
}

export const BlueprintGenerationEngine = {
  async generate(input: GenerationInput): Promise<GenerationOutput> {
    const started = Date.now();
    const tier = normalizeBlueprintTier(input.selectedTier);
    const tierConfig = getTierConfig(tier);
    let chain!: ChainBuildResult;
    let validationContractId: string | null = null;

    await db.transaction(async (tx) => {
      const [validation] = await tx
        .select()
        .from(validations)
        .where(
          and(eq(validations.id, input.validationId), eq(validations.user_id, input.userId)),
        )
        .limit(1);

      if (!validation) {
        throw new TorgimaError("NOT_FOUND", "Validation not found");
      }
      if (validation.blueprint_id !== input.blueprintId) {
        throw new TorgimaError("FORBIDDEN", "Validation does not belong to this blueprint");
      }
      const flowStatus = validation.tier_flow_status ?? "pending";
      if (flowStatus !== "tier_selected" && flowStatus !== "tier_presented") {
        throw new TorgimaError(
          "VALIDATION_ERROR",
          `Validation tier flow must be tier_selected before generation (got ${flowStatus})`,
          false,
        );
      }
      if (!validation.contract_id) {
        throw new TorgimaError("VALIDATION_ERROR", "Validation contract missing", false);
      }
      validationContractId = validation.contract_id;

      const [blueprint] = await tx
        .select()
        .from(blueprints)
        .where(
          and(eq(blueprints.id, input.blueprintId), eq(blueprints.user_id, input.userId)),
        )
        .limit(1);

      if (!blueprint) {
        throw new TorgimaError("NOT_FOUND", "Blueprint not found");
      }
      if (
        blueprint.status !== BlueprintStatus.PATH_SELECTION &&
        blueprint.status !== BlueprintStatus.GENERATING
      ) {
        throw new TorgimaError(
          "VALIDATION_ERROR",
          `Blueprint must be in path_selection before tier generation (status=${blueprint.status})`,
          false,
        );
      }

      const goal = validation.goal_final ?? blueprint.goal_final ?? blueprint.goal;
      const purpose = validation.purpose_final ?? blueprint.purpose_final ?? blueprint.purpose;
      const validationContract = (validation.blueprint_contract ??
        null) as ValidationToBlueprintContract | null;

      await tx
        .update(blueprints)
        .set({
          status: BlueprintStatus.GENERATING,
          tier,
          blueprint_tier: tier,
          selected_blueprint_level: tier,
          selected_path: input.selectedPath,
          generation_depth: tierConfig.generation_depth,
          intelligence_depth: intelligenceDepthForTier(tier),
          tier_config: tierConfig,
          policy_enforcement: mapPolicyEnforcement(tierConfig),
          signal_mode: tierConfig.signal_mode,
          adaptation_mode: tierConfig.adaptation_mode,
          selection_confirmed_at: new Date(),
        })
        .where(eq(blueprints.id, input.blueprintId));

      await clearBlueprintChain(tx, input.blueprintId);

      chain = await buildChainFromTierConfig(tx, {
        blueprintId: input.blueprintId,
        userId: input.userId,
        goal,
        purpose: purpose ?? null,
        tier,
        mode: (blueprint.mode ?? "individual") as "individual" | "team",
        tierConfig,
        validationContract,
      });

      await tx
        .update(blueprints)
        .set({
          status: BlueprintStatus.PATH_SELECTION,
          current_plan_id: chain.planId,
          current_phase_id: chain.phaseId,
        })
        .where(eq(blueprints.id, input.blueprintId));

      await writeEvent(
        {
          eventType: EventTypes.BLUEPRINT_CHAIN_GENERATED,
          entityType: "blueprint",
          entityId: input.blueprintId,
          userId: input.userId,
          blueprintId: input.blueprintId,
          payload: {
            validationId: input.validationId,
            tier,
            selectedPath: input.selectedPath,
            planCount: chain.planCount,
            targetCount: chain.targetCount,
            phaseCount: chain.phaseCount,
            actionCount: chain.actionCount,
            seasonCount: chain.seasonCount,
          },
          idempotencyKey: `blueprint_chain_generated_${input.blueprintId}_${tier}`,
        },
        tx,
      );
    });

    const bhudhi = await enrichNamesWithBhudhi(input.userId, input.blueprintId, {
      goal: input.selectedPath,
      tier,
      tierConfig,
      triggerReason: "TIER_CHAIN_GENERATION",
    });

    const durationMs = Date.now() - started;
    await db.insert(blueprintGenerationLog).values({
      blueprint_id: input.blueprintId,
      user_id: input.userId,
      validation_id: input.validationId,
      tier,
      generation_trigger: "tier_selected",
      layers_generated: {
        plans: chain.planCount,
        seasons: chain.seasonCount,
        targets: chain.targetCount,
        phases: chain.phaseCount,
        actions: chain.actionCount,
      },
      plans_created: chain.planCount,
      seasons_created: chain.seasonCount,
      targets_created: chain.targetCount,
      phases_created: chain.phaseCount,
      projects_created: Math.max(1, tierConfig.project_types.length),
      actions_created: chain.actionCount,
      bhudhi_used: bhudhi.bhudhiUsed,
      bhudhi_log_id: bhudhi.bhudhiLogId ?? null,
      fallback_used: bhudhi.fallbackUsed,
      duration_ms: durationMs,
      status: "complete",
    });

    let launched = false;
    if (input.launchAfterGenerate === true && validationContractId) {
      await blueprintEngine.launch(input.blueprintId, input.userId, validationContractId);
      launched = true;
      await db
        .update(validations)
        .set({ tier_flow_status: "launched" })
        .where(eq(validations.id, input.validationId));
    }

    logger.info(
      { blueprintId: input.blueprintId, tier, durationMs, launched },
      "BlueprintGenerationEngine.generate — complete",
    );

    return {
      blueprintId: input.blueprintId,
      tier,
      chain,
      launched,
      generationSummary: {
        plansCreated: chain.planCount,
        seasonsCreated: chain.seasonCount,
        targetsCreated: chain.targetCount,
        phasesCreated: chain.phaseCount,
        actionsCreated: chain.actionCount,
        durationMs,
        bhudhiUsed: bhudhi.bhudhiUsed,
        fallbackUsed: bhudhi.fallbackUsed,
      },
    };
  },
};
