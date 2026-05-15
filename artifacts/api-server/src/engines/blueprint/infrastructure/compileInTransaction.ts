import { buildTierAwareBlueprintChain, type ChainBuildParams, type ChainBuildResult } from "../BlueprintChainGenerator.js";
import { assertValidHierarchy, type HierarchyNode } from "./HierarchyValidator.js";
import { getBlueprintTypeConfig } from "./BlueprintTypeRegistry.js";
import { gateGenerationCapabilities } from "./FeatureGatingEngine.js";
import { db, blueprints, plans, targets, phases, projects, actions } from "@workspace/db";
import { eq } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Compile chain inside an existing transaction (used by BlueprintEngine.activate). */
export async function compileChainInTransaction(
  tx: Tx,
  input: ChainBuildParams,
): Promise<ChainBuildResult> {
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
