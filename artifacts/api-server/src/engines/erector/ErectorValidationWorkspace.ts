/**
 * Editable validation workspace — 20 sections, partial updates, finalize.
 */
import { db, validations } from "@workspace/db";
import { eq } from "drizzle-orm";
import { TorgimaError } from "../../lib/errors.js";
import { buildValidationSections, SECTION_RECALC_DEPENDENCIES } from "./ErectorValidationSections.js";
import { rowToErectorResult } from "./ErectorOrchestrationHelpers.js";
import type { ValidationSectionCard, ValidationSectionId, ValidationWorkspaceState } from "../../types/erector-refinement.js";
import { assembleHandoffPackage } from "./ErectorStageRunner.js";
import type { ExecutionPathKey } from "../../types/erector-complete.js";
import type { ErectorValidationInput } from "../../types/erector.js";
import { callErectorTrigger } from "./ErectorIntelligenceBridge.js";
import { resolveArchetype } from "./ArchetypeResolutionEngine.js";
import type { BhudhiTriggerType } from "../../types/bhudhi.js";

function inputFromRow(row: typeof validations.$inferSelect, userId: string): ErectorValidationInput & {
  goalFinal?: string;
  purposeFinal?: string;
  economicType?: string;
} {
  const feed = row.validation_feed as Record<string, unknown> | null;
  return {
    userId,
    blueprintId: row.blueprint_id,
    idempotencyKey: row.idempotency_key ?? `erector:${row.id}`,
    rawGoal: row.raw_goal ?? "",
    goalFinal: row.goal_final ?? undefined,
    purposeFinal: row.purpose_final ?? undefined,
    purpose: row.purpose_final ?? row.purpose ?? "",
    timeframe: (feed?.timeframe as { duration_days?: number })?.duration_days
      ? `${(feed?.timeframe as { duration_days: number }).duration_days}d`
      : "90d",
    commitmentLevel: row.commitment_level ?? "MEDIUM",
    desiredOutcome: row.desired_outcome ?? row.goal_final ?? "",
    location: { country: row.location_country ?? "Unknown", city: row.location_city ?? undefined },
    businessType: (row.business_type as "online" | "offline" | "hybrid") ?? "online",
    businessModel: row.business_model ?? "Service",
    budgetAvailable: row.budget_available ?? 0,
    currency: row.currency ?? "USD",
    currentResources: (row.current_resources as string[]) ?? [],
    targetCustomer: row.target_customer ?? "",
    economicType: row.economic_type ?? undefined,
  };
}

function effectiveGoalInput(input: ReturnType<typeof inputFromRow>): ErectorValidationInput {
  const goal = input.goalFinal ?? input.rawGoal;
  const purpose = input.purposeFinal ?? input.purpose;
  return { ...input, rawGoal: goal, purpose };
}

export function getWorkspaceFromRow(row: typeof validations.$inferSelect): ValidationWorkspaceState {
  const sections = (row.validation_sections as ValidationSectionCard[]) ?? [];
  return {
    version: row.validation_workspace_version ?? 0,
    sections,
    finalized: Boolean(row.validation_final),
    originalSnapshot: (row.validation_original_snapshot as Record<string, unknown>) ?? undefined,
    updatedSnapshot: (row.validation_final as Record<string, unknown>) ?? undefined,
  };
}

export async function loadWorkspace(validationId: string, userId: string) {
  const [row] = await db.select().from(validations).where(eq(validations.id, validationId)).limit(1);
  if (!row || row.user_id !== userId) throw new TorgimaError("NOT_FOUND", "Validation not found", false);
  return { row, workspace: getWorkspaceFromRow(row) };
}

export async function applySectionEdit(
  validationId: string,
  userId: string,
  sectionId: ValidationSectionId,
  action: "edit" | "add" | "remove",
  content: string,
) {
  const { row, workspace } = await loadWorkspace(validationId, userId);
  const sections = [...workspace.sections];
  const idx = sections.findIndex((s) => s.id === sectionId);
  const card: ValidationSectionCard =
    idx >= 0
      ? { ...sections[idx]! }
      : {
          id: sectionId,
          title: sectionId,
          sequenceStage: 0,
          content: {},
        };

  const edits = [...(card.userEdits ?? [])];
  if (action === "add" || action === "edit") edits.push(content);
  if (action === "remove") {
    const filtered = edits.filter((e) => e !== content);
    edits.splice(0, edits.length, ...filtered);
  }

  card.userEdits = edits;
  card.pendingChange = true;
  card.lastUpdatedAt = new Date().toISOString();
  if (idx >= 0) sections[idx] = card;
  else sections.push(card);

  await db
    .update(validations)
    .set({
      validation_sections: sections,
      validation_workspace_version: (row.validation_workspace_version ?? 0) + 1,
    })
    .where(eq(validations.id, validationId));

  return { section: card, affectedSections: SECTION_RECALC_DEPENDENCIES[sectionId] ?? [] };
}

export async function updateValidationWorkspace(validationId: string, userId: string) {
  const [row] = await db.select().from(validations).where(eq(validations.id, validationId)).limit(1);
  if (!row || row.user_id !== userId) throw new TorgimaError("NOT_FOUND", "Validation not found", false);

  const sections = (row.validation_sections as ValidationSectionCard[]) ?? [];
  const pending = sections.filter((s) => s.pendingChange);
  if (pending.length === 0) {
    return { updated: false, message: "No pending section changes" };
  }

  const input = effectiveGoalInput(inputFromRow(row, userId));
  const archetypeResolution =
    (row.archetype_resolution as Awaited<ReturnType<typeof resolveArchetype>>) ??
    (await resolveArchetype(input.location.country, input.location.city));

  const triggers = new Set<BhudhiTriggerType>();
  for (const section of pending) {
    for (const t of SECTION_RECALC_DEPENDENCIES[section.id] ?? []) {
      triggers.add(t as BhudhiTriggerType);
    }
  }
  if (triggers.size === 0) {
    triggers.add("ERECTOR_MARKET_ANALYZE");
    triggers.add("ERECTOR_PATHS_GENERATE");
  }

  const patches: Record<string, Record<string, unknown>> = {};
  for (const trigger of triggers) {
    const { data } = await callErectorTrigger(trigger, {
      input,
      archetype: archetypeResolution,
      validationId,
      extraFacts: { workspaceEdits: pending.map((p) => ({ id: p.id, edits: p.userEdits })) },
    });
    patches[trigger] = data;
  }

  const dbPatch: Record<string, unknown> = {};
  if (patches.ERECTOR_MARKET_ANALYZE) dbPatch.market_analysis = patches.ERECTOR_MARKET_ANALYZE;
  if (patches.ERECTOR_COMPETITORS_IDENTIFY) dbPatch.competitor_analysis = patches.ERECTOR_COMPETITORS_IDENTIFY;
  if (patches.ERECTOR_PAIN_ANALYZE) dbPatch.customer_pain_analysis = patches.ERECTOR_PAIN_ANALYZE;
  if (patches.ERECTOR_PATHS_GENERATE) {
    const paths = patches.ERECTOR_PATHS_GENERATE;
    if (paths.current) dbPatch.path_current = paths.current;
    if (paths.adjusted) dbPatch.path_adjusted = paths.adjusted;
    if (paths.alternative) dbPatch.path_alternative = paths.alternative;
  }

  const [updated] = await db
    .update(validations)
    .set(dbPatch)
    .where(eq(validations.id, validationId))
    .returning();

  const result = rowToErectorResult(updated ?? row);
  const rebuilt = buildValidationSections(result, input);
  const cleared = rebuilt.map((s) => {
    const prev = sections.find((p) => p.id === s.id);
    const hadPending = prev?.pendingChange;
    const wasAffected = pending.some((p) => p.id === s.id);
    return {
      ...s,
      userEdits: prev?.userEdits,
      pendingChange: hadPending && wasAffected ? false : (prev?.pendingChange ?? false),
      content: wasAffected && prev?.userEdits?.length
        ? { ...s.content, userNotes: prev.userEdits }
        : s.content,
    };
  });

  await db
    .update(validations)
    .set({
      validation_sections: cleared,
      validation_workspace_version: (row.validation_workspace_version ?? 0) + 1,
      validation_original_snapshot: row.validation_original_snapshot ?? row.erector_payload,
    })
    .where(eq(validations.id, validationId));

  return {
    updated: true,
    triggers: [...triggers],
    workspace: { version: (row.validation_workspace_version ?? 0) + 1, sections: cleared },
  };
}

export async function finalizeValidationWorkspace(validationId: string, userId: string) {
  const [row] = await db.select().from(validations).where(eq(validations.id, validationId)).limit(1);
  if (!row || row.user_id !== userId) throw new TorgimaError("NOT_FOUND", "Validation not found", false);

  const handoff = assembleHandoffPackage(row);

  await db
    .update(validations)
    .set({
      is_finalized: true,
      finalized_at: new Date(),
      handoff_package: handoff,
      validation_final: handoff,
      validation_sections: (row.validation_sections as ValidationSectionCard[])?.map((s) => ({
        ...s,
        pendingChange: false,
      })),
    })
    .where(eq(validations.id, validationId));

  return { finalized: true, handoff_package: handoff };
}

export async function selectExecutionPath(
  validationId: string,
  userId: string,
  path: ExecutionPathKey,
) {
  const [row] = await db.select().from(validations).where(eq(validations.id, validationId)).limit(1);
  if (!row || row.user_id !== userId) throw new TorgimaError("NOT_FOUND", "Validation not found", false);
  if (!row.is_finalized) throw new TorgimaError("VALIDATION_ERROR", "Finalize validation before selecting path", false);

  const pathMap = {
    foundation: row.path_foundation,
    momentum: row.path_momentum,
    overdrive: row.path_overdrive,
  };

  await db
    .update(validations)
    .set({
      selected_execution_path: path,
      selected_path_type: path === "foundation" ? "current" : path === "overdrive" ? "alternative" : "adjusted",
      handoff_package: {
        ...(row.handoff_package as Record<string, unknown>),
        selected_path: path,
      },
    })
    .where(eq(validations.id, validationId));

  return { selected_execution_path: path, path: pathMap[path] };
}

const STAGE_NAME_TO_COLUMN: Record<string, keyof typeof validations.$inferSelect> = {
  purpose_decomposition: "stage_purpose_decomposition",
  economic_resolution: "stage_economic_resolution",
  business_patterns: "stage_business_patterns",
  economy_timing: "stage_economy_timing",
  market_analysis: "stage_market_analysis",
  social_channels: "stage_social_channels",
  pros: "stage_pros",
  cons: "stage_cons",
  feasibility: "stage_feasibility",
  viability: "stage_viability",
  bootstrap: "stage_bootstrap",
  features: "stage_features",
  customer_definition: "stage_customer_definition",
  positioning: "stage_positioning",
  difficulty: "stage_difficulty",
  revenue_path: "stage_revenue_path",
  first_90_days: "stage_first_90_days",
  execution_paths: "stage_execution_paths",
  final_decision: "stage_final_decision",
};

export async function getValidationStage(validationId: string, userId: string, stageName: string) {
  const [row] = await db.select().from(validations).where(eq(validations.id, validationId)).limit(1);
  if (!row || row.user_id !== userId) throw new TorgimaError("NOT_FOUND", "Validation not found", false);
  const column = STAGE_NAME_TO_COLUMN[stageName];
  if (!column) throw new TorgimaError("VALIDATION_ERROR", `Unknown stage: ${stageName}`, false);
  return { stage_name: stageName, data: row[column] };
}

export async function compareValidationVersions(validationId: string, userId: string) {
  const [row] = await db.select().from(validations).where(eq(validations.id, validationId)).limit(1);
  if (!row || row.user_id !== userId) throw new TorgimaError("NOT_FOUND", "Validation not found", false);
  const original = row.validation_original_snapshot ?? {};
  const current = {
    stage_market_analysis: row.stage_market_analysis,
    stage_execution_paths: row.stage_execution_paths,
    stage_final_decision: row.stage_final_decision,
    validation_sections: row.validation_sections,
  };
  const edits = (row.user_edits as Array<Record<string, unknown>>) ?? [];
  return { original, current, changes: edits, validation_version: row.validation_version };
}

export async function populateWorkspaceAfterRun(
  validationId: string,
  result: ReturnType<typeof rowToErectorResult>,
  input: ErectorValidationInput & { goalFinal?: string; purposeFinal?: string; economicType?: string },
) {
  const sections = buildValidationSections(result, input);
  await db
    .update(validations)
    .set({
      validation_sections: sections,
      validation_original_snapshot: result as unknown as Record<string, unknown>,
      validation_workspace_version: 1,
    })
    .where(eq(validations.id, validationId));
}
