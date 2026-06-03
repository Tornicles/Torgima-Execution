import {
  buildTierAwareBlueprintChain,
  type ChainBuildParams,
  type ChainBuildResult,
} from "../BlueprintChainGenerator.js";
import { assertValidHierarchy, type HierarchyNode } from "./HierarchyValidator.js";
import { getBlueprintTypeConfig } from "./BlueprintTypeRegistry.js";
import { gateGenerationCapabilities } from "./FeatureGatingEngine.js";
import { db, blueprints, plans, targets, phases, projects, actions, seasons } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Resolve chain pointers when BlueprintGenerationEngine already materialized the hierarchy. */
export async function resolvePrebuiltChainInTransaction(
  tx: Tx,
  blueprintId: string,
): Promise<ChainBuildResult> {
  const planRows = await tx
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.blueprint_id, blueprintId))
    .orderBy(asc(plans.order_index));
  if (!planRows.length) {
    throw new Error("resolvePrebuiltChainInTransaction: no plans on blueprint");
  }
  const phaseRows = await tx
    .select({ id: phases.id, name: phases.name, status: phases.status })
    .from(phases)
    .where(eq(phases.blueprint_id, blueprintId))
    .orderBy(asc(phases.order_index));
  const initiation =
    phaseRows.find((p) => p.status === "active" && p.name === "initiation") ??
    phaseRows[0];
  if (!initiation) {
    throw new Error("resolvePrebuiltChainInTransaction: no phases on blueprint");
  }
  const targetRows = await tx
    .select({ id: targets.id })
    .from(targets)
    .where(eq(targets.blueprint_id, blueprintId));
  const actionRows = await tx
    .select({ id: actions.id })
    .from(actions)
    .where(eq(actions.blueprint_id, blueprintId));
  const seasonRows = await tx
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.blueprint_id, blueprintId));
  return {
    planId: planRows[0]!.id,
    phaseId: initiation.id,
    planCount: planRows.length,
    phaseCount: phaseRows.length,
    targetCount: targetRows.length,
    actionCount: actionRows.length,
    seasonCount: seasonRows.length,
  };
}

/** Compile chain inside an existing transaction (used by BlueprintEngine.activate). */
export async function compileChainInTransaction(
  tx: Tx,
  input: ChainBuildParams,
): Promise<ChainBuildResult> {
  const [existingPlan] = await tx
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.blueprint_id, input.blueprintId))
    .limit(1);
  if (existingPlan) {
    return resolvePrebuiltChainInTransaction(tx, input.blueprintId);
  }
  return buildTierAwareBlueprintChain(tx, input);
}

export async function validateHierarchyAfterCompile(
  blueprintId: string,
  tier: ChainBuildParams["tier"],
  mode: ChainBuildParams["mode"],
): Promise<void> {
  const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
  const planRows = await db.select().from(plans).where(eq(plans.blueprint_id, blueprintId));
  const targetRows = await db.select().from(targets).where(eq(targets.blueprint_id, blueprintId));
  const phaseRows = await db.select().from(phases).where(eq(phases.blueprint_id, blueprintId));
  const projectRows = await db.select().from(projects).where(eq(projects.blueprint_id, blueprintId));
  const actionRows = await db.select().from(actions).where(eq(actions.blueprint_id, blueprintId));

  const nodes: HierarchyNode[] = [];
  if (bp) {
    nodes.push({ id: blueprintId, layer: "goal", parentId: null, parentLayer: null, tier, mode });
  }
  for (const p of planRows) {
    nodes.push({ id: p.id, layer: "plan", parentId: blueprintId, parentLayer: "goal", tier, mode });
  }
  for (const t of targetRows) {
    nodes.push({ id: t.id, layer: "target", parentId: t.plan_id, parentLayer: "plan", tier, mode });
  }
  for (const ph of phaseRows) {
    nodes.push({ id: ph.id, layer: "phase", parentId: ph.target_id, parentLayer: "target", tier, mode });
  }
  for (const pr of projectRows) {
    nodes.push({ id: pr.id, layer: "project", parentId: pr.phase_id, parentLayer: "phase", tier, mode });
  }
  for (const a of actionRows) {
    nodes.push({ id: a.id, layer: "action", parentId: a.project_id, parentLayer: "project", tier, mode });
  }
  assertValidHierarchy(nodes);

  await db
    .update(blueprints)
    .set({
      blueprint_config: {
        ...(bp?.blueprint_config as Record<string, unknown>),
        compiledAt: new Date().toISOString(),
        generationContract: gateGenerationCapabilities(tier),
        typeConfig: getBlueprintTypeConfig(tier).tier,
      },
      operational_state: "ACTIVE",
    })
    .where(eq(blueprints.id, blueprintId));
}
