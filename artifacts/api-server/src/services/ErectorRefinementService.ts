import { db, blueprints, validations } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";
import { refineGoal, refinePurpose } from "../engines/erector/ErectorRefinementEngine.js";
import type { RefinementPackage, ValidationFeedInput } from "../types/erector-refinement.js";
import { resolveArchetype } from "../engines/erector/ArchetypeResolutionEngine.js";
import { ValidationKind } from "@workspace/state-machine";

async function latestValidation(blueprintId: string, userId: string) {
  const [row] = await db
    .select()
    .from(validations)
    .where(and(eq(validations.blueprint_id, blueprintId), eq(validations.user_id, userId)))
    .orderBy(desc(validations.created_at))
    .limit(1);
  return row ?? null;
}

async function ensureValidationRow(blueprintId: string, userId: string) {
  const existing = await latestValidation(blueprintId, userId);
  if (existing) return existing;
  const [created] = await db
    .insert(validations)
    .values({
      blueprint_id: blueprintId,
      user_id: userId,
      validation_kind: ValidationKind.ERECTOR,
      status: "draft",
      validation_stage: "refinement",
    })
    .returning();
  if (!created) throw new TorgimaError("INTERNAL", "Could not create validation draft", true);
  return created;
}

function refinementFromRow(row: typeof validations.$inferSelect): RefinementPackage {
  return {
    raw_goal: row.raw_goal ?? "",
    goal_options: (row.goal_options as string[]) ?? [],
    goal_understanding: row.goal_understanding as RefinementPackage["goal_understanding"],
    selected_goal_option: row.selected_goal_option ?? undefined,
    goal_final: row.goal_final ?? undefined,
    raw_purpose: row.raw_purpose ?? undefined,
    purpose_options: (row.purpose_options as string[]) ?? [],
    purpose_understanding: row.purpose_understanding as RefinementPackage["purpose_understanding"],
    selected_purpose_option: row.selected_purpose_option ?? undefined,
    purpose_final: row.purpose_final ?? undefined,
    refinement_locked: row.refinement_locked ?? false,
  };
}

export const ErectorRefinementService = {
  async getState(blueprintId: string, userId: string) {
    const row = await latestValidation(blueprintId, userId);
    const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
    if (!bp || bp.user_id !== userId) throw new TorgimaError("NOT_FOUND", "Blueprint not found", false);
    return {
      blueprintId,
      refinement: row ? refinementFromRow(row) : null,
      validationId: row?.id,
      feed: (row?.validation_feed as ValidationFeedInput | null) ?? null,
    };
  },

  async understandGoal(blueprintId: string, userId: string, rawGoal: string) {
    const row = await ensureValidationRow(blueprintId, userId);
    const { understanding, options } = await refineGoal(rawGoal, { userId, blueprintId });
    await db
      .update(validations)
      .set({
        raw_goal: rawGoal,
        goal_understanding: understanding,
        goal_options: options,
        selected_goal_option: null,
        goal_final: null,
      })
      .where(eq(validations.id, row.id));
    await db.update(blueprints).set({ raw_goal: rawGoal }).where(eq(blueprints.id, blueprintId));
    return { understanding, options, validationId: row.id };
  },

  async selectGoal(blueprintId: string, userId: string, optionIndex: number) {
    const row = await ensureValidationRow(blueprintId, userId);
    const options = (row.goal_options as string[]) ?? [];
    if (optionIndex < 0 || optionIndex >= options.length) {
      throw new TorgimaError("VALIDATION_ERROR", "Invalid goal option index", false);
    }
    await db.update(validations).set({ selected_goal_option: optionIndex }).where(eq(validations.id, row.id));
    return { selectedGoalOption: optionIndex, preview: options[optionIndex] };
  },

  async finalizeGoal(blueprintId: string, userId: string, goalFinal: string) {
    const row = await ensureValidationRow(blueprintId, userId);
    if (!goalFinal.trim()) throw new TorgimaError("VALIDATION_ERROR", "goal_final is required", false);
    await db
      .update(validations)
      .set({ goal_final: goalFinal.trim() })
      .where(eq(validations.id, row.id));
    await db
      .update(blueprints)
      .set({ goal: goalFinal.trim(), goal_final: goalFinal.trim() })
      .where(eq(blueprints.id, blueprintId));
    return { goal_final: goalFinal.trim() };
  },

  async understandPurpose(blueprintId: string, userId: string, rawPurpose: string) {
    const row = await ensureValidationRow(blueprintId, userId);
    if (!row.goal_final) {
      throw new TorgimaError("VALIDATION_ERROR", "Finalize goal before refining purpose", false);
    }
    const { understanding, options } = await refinePurpose(rawPurpose, {
      userId,
      blueprintId,
      goalFinal: row.goal_final,
    });
    await db
      .update(validations)
      .set({
        raw_purpose: rawPurpose,
        purpose_understanding: understanding,
        purpose_options: options,
        selected_purpose_option: null,
        purpose_final: null,
      })
      .where(eq(validations.id, row.id));
    await db.update(blueprints).set({ raw_purpose: rawPurpose }).where(eq(blueprints.id, blueprintId));
    return { understanding, options, validationId: row.id };
  },

  async selectPurpose(blueprintId: string, userId: string, optionIndex: number) {
    const row = await ensureValidationRow(blueprintId, userId);
    const options = (row.purpose_options as string[]) ?? [];
    if (optionIndex < 0 || optionIndex >= options.length) {
      throw new TorgimaError("VALIDATION_ERROR", "Invalid purpose option index", false);
    }
    await db.update(validations).set({ selected_purpose_option: optionIndex }).where(eq(validations.id, row.id));
    return { selectedPurposeOption: optionIndex, preview: options[optionIndex] };
  },

  async finalizePurpose(blueprintId: string, userId: string, purposeFinal: string) {
    const row = await ensureValidationRow(blueprintId, userId);
    if (!purposeFinal.trim()) throw new TorgimaError("VALIDATION_ERROR", "purpose_final is required", false);
    await db
      .update(validations)
      .set({ purpose_final: purposeFinal.trim(), purpose: purposeFinal.trim() })
      .where(eq(validations.id, row.id));
    await db
      .update(blueprints)
      .set({ purpose: purposeFinal.trim(), purpose_final: purposeFinal.trim() })
      .where(eq(blueprints.id, blueprintId));
    return { purpose_final: purposeFinal.trim() };
  },

  async lockRefinement(blueprintId: string, userId: string) {
    const row = await ensureValidationRow(blueprintId, userId);
    if (!row.goal_final || !row.purpose_final) {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Both goal_final and purpose_final must be set before locking refinement",
        false,
      );
    }
    const packageJson: RefinementPackage = refinementFromRow({ ...row, refinement_locked: true });
    await db
      .update(validations)
      .set({ refinement_locked: true })
      .where(eq(validations.id, row.id));
    await db
      .update(blueprints)
      .set({
        goal: row.goal_final,
        purpose: row.purpose_final,
        goal_final: row.goal_final,
        purpose_final: row.purpose_final,
      })
      .where(eq(blueprints.id, blueprintId));
    return { locked: true, refinement: packageJson };
  },

  async saveValidationFeed(blueprintId: string, userId: string, feed: ValidationFeedInput) {
    const row = await ensureValidationRow(blueprintId, userId);
    if (!row.refinement_locked && (!row.goal_final || !row.purpose_final)) {
      throw new TorgimaError("VALIDATION_ERROR", "Lock goal and purpose refinement first", false);
    }
    const archetype = await resolveArchetype(feed.country, feed.location_city);
    const economicType = archetype.primaryArchetype.name;
    await db
      .update(validations)
      .set({
        validation_feed: feed,
        goal_final: feed.goal_final,
        purpose_final: feed.purpose_final,
        location_country: feed.country,
        location_city: feed.location_city ?? null,
        business_type: feed.business_type,
        business_model: feed.business_model,
        commitment_level: feed.commitment_level,
        budget_available: feed.budget,
        currency: feed.currency ?? "USD",
        current_resources: feed.resources,
        target_customer: feed.target_customer,
        economic_type: economicType,
        timeframe_days: feed.timeframe?.duration_days ?? null,
        timeframe:
          feed.timeframe?.duration_days != null ? `${feed.timeframe.duration_days} days` : null,
      })
      .where(eq(validations.id, row.id));
    return { validationId: row.id, economicType, feed };
  },

  assertReadyForValidation(row: typeof validations.$inferSelect) {
    if (!row.refinement_locked || !row.goal_final || !row.purpose_final) {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Complete goal and purpose refinement before running Erector validation",
        false,
      );
    }
    const feed = row.validation_feed as ValidationFeedInput | null;
    if (!feed?.country || !feed.business_type || !feed.target_customer) {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Complete validation feed (country, business type, target customer) before running validation",
        false,
      );
    }
  },
};
