import { eq } from "drizzle-orm";
import {
  blueprints,
  db,
  erectorArchetypeClassifications,
  erectorUserRealityProfiles,
} from "@workspace/db";
import { writeEvent, EVENT_TYPES } from "../../../services/EventService.js";
import { loadArchetypeRulePack } from "./ArchetypeRulePackLoader.js";
import { classifyEconomicTypeFromProfile } from "./EconomicTypeClassifier.js";
import { resolveHybridArchetype } from "./HybridArchetypeResolver.js";
import { computeUnitEconomics } from "./UnitEconomicsLayer.js";
import type { ArchetypeRulePack, HybridResolution, ProfileInput, UnitEconomics } from "./types.js";

export type EconomicClassificationResult = {
  classification_id: string;
  primary_archetype: string;
  secondary_archetype: string | null;
  tertiary_modifier: string | null;
  is_hybrid: boolean;
  classification_confidence: number;
  classification_reason: string;
  rule_pack_id: string;
  rule_pack_version: string;
  rule_pack: ArchetypeRulePack | null;
  unit_economics: UnitEconomics;
  hybrid: HybridResolution;
};

export async function classifyEconomicType(input: {
  validationRunId: string;
  profileId: string;
  userId: string;
  tier: string;
  blueprintId?: string | null;
}): Promise<EconomicClassificationResult> {
  const [profile] = await db
    .select()
    .from(erectorUserRealityProfiles)
    .where(eq(erectorUserRealityProfiles.id, input.profileId))
    .limit(1);
  if (!profile) throw new Error("Reality profile not found");

  const classification = classifyEconomicTypeFromProfile(profile as ProfileInput);
  const hybrid = resolveHybridArchetype(profile as ProfileInput, classification);
  const rulePack = await loadArchetypeRulePack(classification.primary_archetype, input.tier);
  const unitEconomics = computeUnitEconomics(
    profile as ProfileInput,
    classification.primary_archetype,
    rulePack,
  );

  const rule_pack_id = rulePack?.archetype_id ?? classification.primary_archetype;
  const rule_pack_version = rulePack?.archetype_version ?? "v0.1";

  const [row] = await db
    .insert(erectorArchetypeClassifications)
    .values({
      user_id: input.userId,
      validation_run_id: input.validationRunId,
      blueprint_id: input.blueprintId ?? null,
      primary_archetype: classification.primary_archetype,
      secondary_archetype: hybrid.secondary_archetype,
      tertiary_modifier: hybrid.tertiary_modifier,
      is_hybrid: hybrid.is_hybrid,
      hybrid_blend: {
        revenue_modifier: hybrid.revenue_modifier,
        delivery_modifier: hybrid.delivery_modifier,
        dominant_risk: hybrid.dominant_risk,
        secondary_risk: hybrid.secondary_risk,
        simulation_priority: hybrid.simulation_priority,
      },
      classification_confidence: String(classification.classification_confidence),
      classification_reason: hybrid.explanation || classification.classification_reason,
      rule_pack_id,
      rule_pack_version,
      unit_economics: unitEconomics,
    })
    .returning({ id: erectorArchetypeClassifications.id });

  if (!row) throw new Error("Failed to persist archetype classification");

  if (input.blueprintId) {
    await db
      .update(blueprints)
      .set({ erector_archetype: classification.primary_archetype })
      .where(eq(blueprints.id, input.blueprintId));
  }

  await writeEvent({
    eventType: EVENT_TYPES.ERECTOR_ARCHETYPE_CLASSIFIED,
    entityType: "erector_archetype_classification",
    entityId: row.id,
    userId: input.userId,
    blueprintId: input.blueprintId ?? undefined,
    payload: {
      validation_run_id: input.validationRunId,
      profile_id: input.profileId,
      primary_archetype: classification.primary_archetype,
      secondary_archetype: hybrid.secondary_archetype,
      is_hybrid: hybrid.is_hybrid,
      classification_confidence: classification.classification_confidence,
      rule_pack_id,
      unit_economics: unitEconomics,
    },
    idempotencyKey: `erector_archetype_classified:${input.validationRunId}`,
  });

  return {
    classification_id: row.id,
    primary_archetype: classification.primary_archetype,
    secondary_archetype: hybrid.secondary_archetype,
    tertiary_modifier: hybrid.tertiary_modifier,
    is_hybrid: hybrid.is_hybrid,
    classification_confidence: classification.classification_confidence,
    classification_reason: classification.classification_reason,
    rule_pack_id,
    rule_pack_version,
    rule_pack: rulePack,
    unit_economics: unitEconomics,
    hybrid,
  };
}
