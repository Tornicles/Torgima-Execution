import { db, plans, seasons, targets, phases, projects, actions, blueprints, validations } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { TorgimaError } from "../../../lib/errors.js";
import { buildTierAwareBlueprintChain } from "../BlueprintChainGenerator.js";
import type { ValidationToBlueprintContract } from "../../validation/intelligence/validation-intelligence-types.js";
import { applyContractToChainSkeleton } from "../../validation/intelligence/ValidationToBlueprintBridge.js";
import { parseMode, parseTier, assertSelectionComplete, buildTraceMetadata } from "../BlueprintRuleEngine.js";
import { getBlueprintTypeConfig } from "./BlueprintTypeRegistry.js";
import { assertFeatureAllowed, gateGenerationCapabilities } from "./FeatureGatingEngine.js";
import { assertValidHierarchy, type HierarchyNode } from "./HierarchyValidator.js";
import { DOMAIN_PHASE1_STATUS, type Domain } from "../../../constants/domains.js";

export interface BlueprintCompileInput {
  blueprintId: string;
  userId: string;
  goal: string;
  purpose: string | null;
  domain: string;
  pathSkeleton?: {
    plans: Array<{ name: string; description: string }>;
    targets: Array<{ name: string; type: string }>;
  };
  /** Required for launch-time compiles; loaded from validations when omitted. */
  validationContract?: ValidationToBlueprintContract | null;
}

export interface BlueprintCompileResult {
  ok: boolean;
  chain?: {
    planId: string;
    phaseId: string;
    planCount: number;
    phaseCount: number;
    targetCount: number;
    actionCount: number;
    seasonCount: number;
  };
  violations: string[];
  generationContract: ReturnType<typeof gateGenerationCapabilities>;
}

export async function compileBlueprint(input: BlueprintCompileInput): Promise<BlueprintCompileResult> {
  const violations: string[] = [];

  const [bp] = await db
    .select()
    .from(blueprints)
    .where(eq(blueprints.id, input.blueprintId))
    .limit(1);

  if (!bp) {
    return { ok: false, violations: ["blueprint not found"], generationContract: gateGenerationCapabilities("starter") };
  }

  try {
    assertSelectionComplete({
      blueprintId: bp.id,
      status: bp.status,
      tier: bp.tier,
      mode: bp.mode,
      selectionConfirmedAt: bp.selection_confirmed_at,
    });
  } catch {
    violations.push("tier/mode selection not confirmed");
  }

  const tier = parseTier(bp.tier);
  const mode = parseMode(bp.mode);
  const cfg = getBlueprintTypeConfig(tier);

  const domainStatus = DOMAIN_PHASE1_STATUS[input.domain as Domain];
  if (domainStatus === "disabled") {
    violations.push(`domain ${input.domain} is disabled for this phase`);
  }

  if (violations.length > 0) {
    return { ok: false, violations, generationContract: gateGenerationCapabilities(tier) };
  }

  let validationContract = input.validationContract ?? null;
  if (!validationContract) {
    const [valRow] = await db
      .select({ blueprint_contract: validations.blueprint_contract })
      .from(validations)
      .where(eq(validations.blueprint_id, input.blueprintId))
      .orderBy(desc(validations.created_at))
      .limit(1);
    validationContract = (valRow?.blueprint_contract as ValidationToBlueprintContract | null) ?? null;
  }

  if (!validationContract) {
    violations.push("ValidationToBlueprintContract required — complete validation and select a path first");
    return { ok: false, violations, generationContract: gateGenerationCapabilities(tier) };
  }

  const pathSkeleton = applyContractToChainSkeleton(
    validationContract,
    input.pathSkeleton ?? validationContract.plan_skeleton,
  );

  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

  const runBuild = async (tx: Tx) =>
    buildTierAwareBlueprintChain(tx, {
      blueprintId: input.blueprintId,
      userId: input.userId,
      goal: validationContract!.refined_goal || input.goal,
      purpose: input.purpose,
      tier,
      mode,
      pathSkeleton,
      validationContract,
    });

  const chain = await db.transaction(runBuild);

  const nodes = await loadHierarchyNodes(input.blueprintId, tier, mode);
  try {
    assertValidHierarchy(nodes);
  } catch (e) {
    violations.push(e instanceof Error ? e.message : "hierarchy invalid");
    return { ok: false, violations, generationContract: gateGenerationCapabilities(tier) };
  }

  await db
    .update(blueprints)
    .set({
      blueprint_config: {
        ...(bp.blueprint_config as Record<string, unknown>),
        compiledAt: new Date().toISOString(),
        compileVersion: (bp.version ?? 1) + 1,
        generationContract: gateGenerationCapabilities(tier),
      },
    })
    .where(eq(blueprints.id, input.blueprintId));

  return {
    ok: true,
    chain,
    violations: [],
    generationContract: gateGenerationCapabilities(tier),
  };
}

async function loadHierarchyNodes(
  blueprintId: string,
  tier: ReturnType<typeof parseTier>,
  mode: ReturnType<typeof parseMode>,
): Promise<HierarchyNode[]> {
  const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
  const planRows = await db.select().from(plans).where(eq(plans.blueprint_id, blueprintId));
  const targetRows = await db.select().from(targets).where(eq(targets.blueprint_id, blueprintId));
  const phaseRows = await db.select().from(phases).where(eq(phases.blueprint_id, blueprintId));
  const projectRows = await db.select().from(projects).where(eq(projects.blueprint_id, blueprintId));
  const actionRows = await db.select().from(actions).where(eq(actions.blueprint_id, blueprintId));

  const nodes: HierarchyNode[] = [];
  if (bp) {
    nodes.push({
      id: blueprintId,
      layer: "goal",
      parentId: null,
      parentLayer: null,
      tier,
      mode,
    });
  }
  for (const p of planRows) {
    nodes.push({
      id: p.id,
      layer: "plan",
      parentId: blueprintId,
      parentLayer: "goal",
      tier,
      mode,
    });
  }
  for (const t of targetRows) {
    nodes.push({
      id: t.id,
      layer: "target",
      parentId: t.plan_id,
      parentLayer: "plan",
      tier,
      mode,
    });
  }
  for (const ph of phaseRows) {
    nodes.push({
      id: ph.id,
      layer: "phase",
      parentId: ph.target_id,
      parentLayer: "target",
      tier,
      mode,
    });
  }
  for (const pr of projectRows) {
    nodes.push({
      id: pr.id,
      layer: "project",
      parentId: pr.phase_id,
      parentLayer: "phase",
      tier,
      mode,
    });
  }
  for (const a of actionRows) {
    nodes.push({
      id: a.id,
      layer: "action",
      parentId: a.project_id,
      parentLayer: "project",
      tier,
      mode,
    });
  }
  return nodes;
}

export async function compileBlueprintOrThrow(input: BlueprintCompileInput) {
  const result = await compileBlueprint(input);
  if (!result.ok) {
    throw new TorgimaError("VALIDATION_ERROR", result.violations.join("; "));
  }
  return result;
}
