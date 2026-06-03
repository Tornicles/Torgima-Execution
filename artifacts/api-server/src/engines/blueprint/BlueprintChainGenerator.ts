import {
  plans,
  seasons,
  targets,
  phases,
  projects,
  actions,
  blueprintPolicies,
} from "@workspace/db";
import { TorgimaError } from "../../lib/errors.js";
import {
  type BlueprintMode,
  type BlueprintTier,
  buildTraceMetadata,
  DEFAULT_PLAN_NAMES,
  DEFAULT_SEASON_NAMES,
  getModeRules,
} from "./BlueprintRuleEngine.js";
import { getBlueprintTypeConfig } from "./infrastructure/BlueprintTypeRegistry.js";
import type { ValidationToBlueprintContract } from "../validation/intelligence/validation-intelligence-types.js";
import { applyContractToChainSkeleton } from "../validation/intelligence/ValidationToBlueprintBridge.js";
import type { TierActionType, TierConfig, TierProjectType, TierTargetType } from "./TierConfig.js";
import { eq } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof import("@workspace/db").db.transaction>[0]>[0];

export interface ChainBuildParams {
  blueprintId: string;
  userId: string;
  goal: string;
  purpose: string | null;
  tier: BlueprintTier;
  mode: BlueprintMode;
  pathSkeleton?: {
    plans: Array<{ name: string; description: string }>;
    targets: Array<{ name: string; type: string }>;
  };
  validationContract?: ValidationToBlueprintContract | null;
  /** When set, chain counts and types follow frozen TierConfig (BlueprintGenerationEngine). */
  tierConfig?: TierConfig;
}

export interface ChainBuildResult {
  planId: string;
  phaseId: string;
  planCount: number;
  phaseCount: number;
  targetCount: number;
  actionCount: number;
  seasonCount: number;
}

const TARGET_TYPES = [
  "major",
  "primary",
  "vital",
  "operating",
  "production",
  "conditional",
] as const;

const PROJECT_TYPES = ["setup", "execution", "analysis", "optimization"] as const;

const ACTION_TEMPLATES = [
  {
    name: "Create the first customer segment",
    type: "create" as const,
    category: "market_definition",
  },
  {
    name: "Analyze proof-of-demand evidence",
    type: "analyze" as const,
    category: "validation",
  },
  {
    name: "Replicate the strongest outreach pattern",
    type: "replicate" as const,
    category: "distribution",
  },
  {
    name: "Improve the offer promise",
    type: "improve" as const,
    category: "offer_optimization",
  },
];

function targetTypesForTier(tier: BlueprintTier): Array<(typeof TARGET_TYPES)[number]> {
  if (tier === "starter") return ["major", "primary", "production"];
  return [...TARGET_TYPES];
}

function projectTypesForTier(tier: BlueprintTier): typeof PROJECT_TYPES[number][] {
  if (tier === "starter") return ["setup", "execution"];
  return [...PROJECT_TYPES];
}

function actionTemplatesForTier(tier: BlueprintTier): typeof ACTION_TEMPLATES {
  if (tier === "starter") return ACTION_TEMPLATES.filter((a) => a.type === "create" || a.type === "analyze") as typeof ACTION_TEMPLATES;
  return ACTION_TEMPLATES;
}

function pickTargetType(index: number, tier: BlueprintTier): (typeof TARGET_TYPES)[number] {
  const tierTargetTypes = targetTypesForTier(tier);
  return tierTargetTypes[index % tierTargetTypes.length] ?? "primary";
}

const ACTION_LABELS: Record<TierActionType, { name: string; category: string }> = {
  create: { name: "Create the first deliverable", category: "execution" },
  replicate: { name: "Replicate the strongest pattern", category: "distribution" },
  analyze: { name: "Analyze proof-of-demand evidence", category: "validation" },
  improve: { name: "Improve the core offer promise", category: "offer_optimization" },
};

const PROJECT_LABELS: Record<TierProjectType, string> = {
  setup: "Setup & Foundation",
  execution: "Core Execution",
  analysis: "Analysis & Proof",
  optimization: "Optimization Pass",
};

function policyEnforcementLevel(
  mode: TierConfig["policy_enforcement"],
): "display" | "guidance" | "strict" {
  if (mode === "enforced") return "strict";
  if (mode === "applied") return "guidance";
  return "display";
}

/** Remove prior chain rows before tier-config regeneration. */
export async function clearBlueprintChain(tx: Tx, blueprintId: string): Promise<void> {
  await tx.delete(actions).where(eq(actions.blueprint_id, blueprintId));
  await tx.delete(projects).where(eq(projects.blueprint_id, blueprintId));
  await tx.delete(phases).where(eq(phases.blueprint_id, blueprintId));
  await tx.delete(targets).where(eq(targets.blueprint_id, blueprintId));
  await tx.delete(seasons).where(eq(seasons.blueprint_id, blueprintId));
  await tx.delete(plans).where(eq(plans.blueprint_id, blueprintId));
  await tx.delete(blueprintPolicies).where(eq(blueprintPolicies.blueprint_id, blueprintId));
}

/** Build execution chain from frozen TierConfig (plans → seasons → targets → phases → projects → actions). */
export async function buildChainFromTierConfig(
  tx: Tx,
  params: ChainBuildParams & { tierConfig: TierConfig },
): Promise<ChainBuildResult> {
  const cfg = params.tierConfig;
  const modeRules = getModeRules(params.mode);
  const contributorIds = modeRules.distributedExecution ? [params.userId] : [];
  const goalShort = params.goal.slice(0, 80);
  const phaseGates = cfg.phase_mode !== "linear";
  const phaseDefinitions = cfg.phases.map((name, idx) => ({
    name,
    orderIndex: idx + 1,
    status: (idx === 0 ? "active" : "pending") as "active" | "pending",
    locked: phaseGates && idx > 0,
  }));

  const insertedPlans: { id: string; name: string }[] = [];
  for (let i = 0; i < cfg.plans.length; i++) {
    const name = cfg.plans[i]!;
    const [plan] = await tx
      .insert(plans)
      .values({
        blueprint_id: params.blueprintId,
        user_id: params.userId,
        name,
        title: name,
        description: i === 0 ? params.goal : name,
        purpose: i === 0 ? params.purpose : `Execution layer ${i + 1} for ${goalShort}`,
        outcome: i === 0 ? "First operational proof" : `Progress marker for ${name}`,
        order_index: i + 1,
        status: i === 0 ? "active" : "pending",
      })
      .returning({ id: plans.id, name: plans.name });
    if (!plan) throw new TorgimaError("INTERNAL_ERROR", "Failed to create plan");
    insertedPlans.push(plan);
  }
  const primaryPlan = insertedPlans[0]!;

  let seasonCount = 0;
  if (cfg.seasons_enabled && cfg.seasons?.length) {
    for (let i = 0; i < insertedPlans.length; i++) {
      const plan = insertedPlans[i]!;
      const seasonName = cfg.seasons[i] ?? cfg.seasons[cfg.seasons.length - 1]!;
      await tx.insert(seasons).values({
        blueprint_id: params.blueprintId,
        plan_id: plan.id,
        name: seasonName,
        order_index: i + 1,
        effort_level:
          params.tier === "starter" ? "light"
          : params.tier === "ultimate" ? "high"
          : "moderate",
        status: i === 0 ? "active" : "pending",
      });
      seasonCount++;
    }
  }

  const insertedTargets: { id: string; name: string; type: string; planId: string }[] = [];
  for (const plan of insertedPlans) {
    for (let tt = 0; tt < cfg.target_types.length; tt++) {
      const validType = cfg.target_types[tt]! as TierTargetType;
      const defName = `${validType} — ${plan.name}`;
      const [target] = await tx
        .insert(targets)
        .values({
          blueprint_id: params.blueprintId,
          plan_id: plan.id,
          user_id: params.userId,
          owner_id: params.userId,
          contributor_ids: contributorIds,
          name: defName,
          title: defName,
          description: tt === 0 && plan.id === primaryPlan.id ? params.goal : defName,
          type: validType,
          target_type: validType,
          metric_name:
            validType === "major" ? "outcome_progress"
            : validType === "primary" ? "primary_progress"
            : validType === "production" ? "proof_outputs"
            : validType === "conditional" ? "risk_control"
            : "execution_progress",
          order_index: insertedTargets.length + 1,
          status: insertedTargets.length === 0 ? "active" : "pending",
          trace_metadata: buildTraceMetadata({
            layer: "target",
            parentId: plan.id,
            parentLayer: "plan",
            tier: params.tier,
            mode: params.mode,
            generationReason: `tier_config_target_${validType}`,
          }),
        })
        .returning({ id: targets.id, name: targets.name, type: targets.type });
      if (!target) throw new TorgimaError("INTERNAL_ERROR", "Failed to create target");
      insertedTargets.push({ id: target.id, name: target.name, type: target.type, planId: plan.id });
    }
  }
  const primaryTarget = insertedTargets[0]!;

  const insertedPhases: { id: string; name: string; targetId: string; planId: string }[] = [];
  for (const target of insertedTargets) {
    const activeFirst =
      target.id === primaryTarget.id && target.planId === primaryPlan.id;
    for (const def of phaseDefinitions) {
      const activePhase = activeFirst && def.name === cfg.phases[0];
      const title = def.name[0]!.toUpperCase() + def.name.slice(1);
      const [p] = await tx
        .insert(phases)
        .values({
          blueprint_id: params.blueprintId,
          target_id: target.id,
          plan_id: target.planId,
          user_id: params.userId,
          name: def.name,
          title,
          description: `${title} phase for ${target.name}`,
          order_index: def.orderIndex,
          status: activePhase ? "active" : "pending",
          locked: def.locked,
          is_active: activePhase,
          progress_percent: 0,
          gate_passed: false,
          gate_criteria:
            phaseGates ?
              { min_completion_rate: def.name === "initiation" ? 0.6 : 0.75, min_momentum: 40 }
            : { min_completion_rate: 0.5 },
          unlock_criteria:
            phaseGates ?
              { min_completion_rate: def.name === "initiation" ? 0.6 : 0.75, min_momentum: 40 }
            : { min_completion_rate: 0.5 },
          started_at: activePhase ? new Date() : null,
          trace_metadata: buildTraceMetadata({
            layer: "phase",
            parentId: target.id,
            parentLayer: "target",
            tier: params.tier,
            mode: params.mode,
            generationReason: `phase_${def.name}`,
          }),
        })
        .returning({ id: phases.id, name: phases.name });
      if (!p) throw new TorgimaError("INTERNAL_ERROR", `Failed to create phase: ${def.name}`);
      insertedPhases.push({
        id: p.id,
        name: p.name,
        targetId: target.id,
        planId: target.planId,
      });
    }
  }

  const initiationPhase =
    insertedPhases.find(
      (p) => p.name === cfg.phases[0] && p.targetId === primaryTarget.id,
    ) ?? insertedPhases[0]!;

  let actionCount = 0;
  let projectCount = 0;
  for (let pi = 0; pi < cfg.project_types.length; pi++) {
    const pType = cfg.project_types[pi]!;
    const [project] = await tx
      .insert(projects)
      .values({
        blueprint_id: params.blueprintId,
        phase_id: initiationPhase.id,
        target_id: primaryTarget.id,
        user_id: params.userId,
        owner_id: params.userId,
        assignee_ids: modeRules.distributedExecution ? [params.userId] : [],
        name: pi === 0 ? PROJECT_LABELS[pType] : `${PROJECT_LABELS[pType]} — ${goalShort}`,
        title: pi === 0 ? PROJECT_LABELS[pType] : `${PROJECT_LABELS[pType]} — ${goalShort}`,
        description: `Work package (${pType}) for ${params.goal.slice(0, 60)}`,
        type: pType,
        project_type: pType,
        order_index: pi + 1,
        status: pi === 0 ? "active" : "pending",
        started_at: pi === 0 ? new Date() : null,
        trace_metadata: buildTraceMetadata({
          layer: "project",
          parentId: initiationPhase.id,
          parentLayer: "phase",
          tier: params.tier,
          mode: params.mode,
          generationReason: `project_${pType}`,
        }),
      })
      .returning({ id: projects.id });
    if (!project) throw new TorgimaError("INTERNAL_ERROR", "Failed to create project");
    projectCount++;

    for (let ai = 0; ai < cfg.action_types.length; ai++) {
      const actionType = cfg.action_types[ai]!;
      const label = ACTION_LABELS[actionType];
      await tx.insert(actions).values({
        blueprint_id: params.blueprintId,
        project_id: project.id,
        target_id: primaryTarget.id,
        user_id: params.userId,
        name: label.name,
        title: label.name,
        description: label.name,
        type: actionType,
        action_type: actionType,
        expected_output: `Completed ${actionType} output`,
        knowledge_category: label.category,
        order_index: ai + 1,
        status: "pending",
        trace_metadata: buildTraceMetadata({
          layer: "action",
          parentId: project.id,
          parentLayer: "project",
          tier: params.tier,
          mode: params.mode,
          generationReason: `action_${actionType}`,
        }),
      });
      actionCount++;
    }
  }

  if (cfg.policy_enforcement !== "display_only") {
    const level = policyEnforcementLevel(cfg.policy_enforcement);
    await tx.insert(blueprintPolicies).values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      focus_statement: params.purpose ?? `Execute: ${goalShort}`,
      anti_focus: params.tier === "starter" ? "Avoid scope creep" : "Avoid unfocused expansion",
      rules: [
        { code: "SIGNAL_AUTHORITY", description: "Signals define truth — never overridden by AI" },
        { code: "CONDITION_AUTHORITY", description: "Condition controls execution posture" },
      ],
      enforcement_level: level === "strict" ? "strict" : "guidance",
      generated_from: { tier: params.tier, mode: params.mode, tierConfig: true },
      active: true,
    });
  }

  return {
    planId: primaryPlan.id,
    phaseId: initiationPhase.id,
    planCount: insertedPlans.length,
    phaseCount: insertedPhases.length,
    targetCount: insertedTargets.length,
    actionCount,
    seasonCount,
  };
}

export async function buildTierAwareBlueprintChain(
  tx: Tx,
  params: ChainBuildParams,
): Promise<ChainBuildResult> {
  if (params.tierConfig) {
    return buildChainFromTierConfig(tx, params as ChainBuildParams & { tierConfig: TierConfig });
  }
  const tierRules = getBlueprintTypeConfig(params.tier);
  const modeRules = getModeRules(params.mode);
  const goalShort = params.goal.slice(0, 60);
  const tierTargetTypes = targetTypesForTier(params.tier);
  const targetsPerPlan = tierTargetTypes.length;

  const contractedSkeleton =
    params.validationContract ?
      applyContractToChainSkeleton(params.validationContract, params.pathSkeleton)
    : params.pathSkeleton;

  const planDefs =
    contractedSkeleton?.plans?.length ?
      contractedSkeleton.plans.slice(0, tierRules.planCount)
    : DEFAULT_PLAN_NAMES.slice(0, tierRules.planCount).map((name, i) => ({
        name,
        description:
          i === 0 ?
            `Foundation execution for: ${goalShort}`
          : `${name} phase outcomes for: ${goalShort}`,
      }));

  while (planDefs.length < tierRules.planCount) {
    const idx = planDefs.length;
    planDefs.push({
      name: DEFAULT_PLAN_NAMES[idx] ?? `Plan ${idx + 1}`,
      description: `Execution plan layer ${idx + 1}`,
    });
  }

  const insertedPlans: { id: string; name: string; orderIndex: number }[] = [];
  for (let i = 0; i < planDefs.length; i++) {
    const def = planDefs[i]!;
    const [plan] = await tx
      .insert(plans)
      .values({
        blueprint_id: params.blueprintId,
        user_id: params.userId,
        name: def.name,
        title: def.name,
        description: def.description,
        purpose: i === 0 ? params.purpose : `Execution layer ${i + 1} for ${goalShort}`,
        outcome: i === 0 ? "First operational proof and customer clarity" : `Progress marker for ${def.name}`,
        order_index: i + 1,
        status: i === 0 ? "active" : "pending",
      })
      .returning({ id: plans.id, name: plans.name });
    if (!plan) throw new TorgimaError("INTERNAL_ERROR", "Failed to create plan");
    insertedPlans.push({ id: plan.id, name: plan.name, orderIndex: i + 1 });
  }

  const primaryPlan = insertedPlans[0]!;

  const seasonNames = DEFAULT_SEASON_NAMES.slice(0, tierRules.seasonCount);
  for (let s = 0; s < seasonNames.length; s++) {
    const seasonName = seasonNames[s]!;
    await tx.insert(seasons).values({
      blueprint_id: params.blueprintId,
      plan_id: insertedPlans[Math.min(s, insertedPlans.length - 1)]!.id,
      name: seasonName,
      order_index: s + 1,
      effort_level: params.tier === "starter" ? "light" : params.tier === "ultimate" ? "high" : "moderate",
      status: s === 0 ? "active" : "pending",
    });
  }

  const targetDefs =
    contractedSkeleton?.targets?.length ?
      contractedSkeleton.targets.slice(0, tierRules.targetCount)
    : Array.from({ length: tierRules.targetCount }, (_, i) => ({
        name: `${pickTargetType(i, params.tier)} target for ${params.goal.slice(0, 70)}`,
        type: pickTargetType(i, params.tier),
      }));

  const insertedTargets: { id: string; name: string; type: string }[] = [];
  for (let t = 0; t < tierRules.targetCount; t++) {
    const def = targetDefs[t] ?? {
      name: `Target ${t + 1}`,
      type: pickTargetType(t, params.tier),
    };
    const validType = TARGET_TYPES.includes(def.type as (typeof TARGET_TYPES)[number]) ?
        (def.type as (typeof TARGET_TYPES)[number])
      : pickTargetType(t, params.tier);

    const contributorIds: string[] =
      modeRules.contributorAssignment && t > 0 ? [params.userId] : [];

    const [target] = await tx
      .insert(targets)
      .values({
        blueprint_id: params.blueprintId,
        plan_id: insertedPlans[Math.floor(t / targetsPerPlan) % insertedPlans.length]!.id,
        user_id: params.userId,
        owner_id: params.userId,
        contributor_ids: contributorIds,
        name: def.name,
        title: def.name,
        description: t === 0 ? params.goal : def.name,
        type: validType,
        target_type: validType,
        metric_name:
          validType === "major" ? "outcome_progress"
          : validType === "primary" ? "primary_progress"
          : validType === "production" ? "proof_outputs"
          : validType === "conditional" ? "risk_control"
          : "execution_progress",
        order_index: t + 1,
        status: t === 0 ? "active" : "pending",
        trace_metadata: {
          ...buildTraceMetadata({
            layer: "target",
            parentId: insertedPlans[Math.floor(t / targetsPerPlan) % insertedPlans.length]!.id,
            parentLayer: "plan",
            tier: params.tier,
            mode: params.mode,
            generationReason: `tier_${params.tier}_mode_${params.mode}_target_${t}`,
          }),
          targetDistribution:
            params.mode === "team" ?
              { ownerId: params.userId, contributorIds, distributionLayer: "target_owner_execution" }
            : { ownerId: params.userId, contributorIds: [], distributionLayer: "individual_execution" },
        },
      })
      .returning({ id: targets.id, name: targets.name, type: targets.type });
    if (!target) throw new TorgimaError("INTERNAL_ERROR", "Failed to create target");
    insertedTargets.push({ id: target.id, name: target.name, type: target.type });
  }

  const primaryTarget = insertedTargets[0]!;

  const phaseDefinitions = [
    { name: "initiation" as const, orderIndex: 1, status: "active" as const, locked: false },
    {
      name: "development" as const,
      orderIndex: 2,
      status: "pending" as const,
      locked: tierRules.phaseGates,
    },
    {
      name: "completion" as const,
      orderIndex: 3,
      status: "pending" as const,
      locked: tierRules.phaseGates,
    },
  ].slice(0, tierRules.phaseCount);

  const insertedPhases: { id: string; name: string; planId: string }[] = [];
  for (const plan of insertedPlans) {
    const planTarget =
      insertedTargets.find((_, index) => insertedPlans[Math.floor(index / targetsPerPlan) % insertedPlans.length]?.id === plan.id) ??
      primaryTarget;
    for (const def of phaseDefinitions) {
      const activeFirstPhase = plan.id === primaryPlan.id && def.name === "initiation";
      const title = def.name[0]!.toUpperCase() + def.name.slice(1);
      const [p] = await tx
        .insert(phases)
        .values({
          blueprint_id: params.blueprintId,
          target_id: planTarget.id,
          plan_id: plan.id,
          user_id: params.userId,
          name: def.name,
          title,
          description: `${title} phase for ${plan.name}`,
          order_index: def.orderIndex,
          status: activeFirstPhase ? "active" : "pending",
          locked: !activeFirstPhase,
          is_active: activeFirstPhase,
          progress_percent: 0,
          gate_passed: false,
          gate_criteria:
            tierRules.phaseGates ?
              { min_completion_rate: def.name === "initiation" ? 0.6 : 0.75, min_momentum: 40 }
            : { min_completion_rate: 0.5 },
          unlock_criteria:
            tierRules.phaseGates ?
              { min_completion_rate: def.name === "initiation" ? 0.6 : 0.75, min_momentum: 40 }
            : { min_completion_rate: 0.5 },
          started_at: activeFirstPhase ? new Date() : null,
          trace_metadata: buildTraceMetadata({
            layer: "phase",
            parentId: planTarget.id,
            parentLayer: "target",
            tier: params.tier,
            mode: params.mode,
            generationReason: `phase_${def.name}`,
          }),
        })
        .returning({ id: phases.id, name: phases.name });
      if (!p) throw new TorgimaError("INTERNAL_ERROR", `Failed to create phase: ${def.name}`);
      insertedPhases.push({ id: p.id, name: p.name, planId: plan.id });
    }
  }

  const initiationPhase =
    insertedPhases.find((p) => p.name === "initiation" && p.planId === primaryPlan.id) ?? insertedPhases[0]!;

  let actionCount = 0;
  const projectTypes = projectTypesForTier(params.tier);
  const actionTemplates = actionTemplatesForTier(params.tier);

  for (let pi = 0; pi < tierRules.projectsPerActivePhase; pi++) {
    const [project] = await tx
      .insert(projects)
      .values({
        blueprint_id: params.blueprintId,
        phase_id: initiationPhase.id,
        target_id: primaryTarget.id,
        user_id: params.userId,
        owner_id: params.userId,
        assignee_ids: modeRules.distributedExecution ? [params.userId] : [],
        name:
          pi === 0 ?
            "Setup & Foundation"
          : `${projectTypes[pi] ?? "execution"} — ${goalShort}`,
        title:
          pi === 0 ?
            "Setup & Foundation"
          : `${projectTypes[pi] ?? "execution"} — ${goalShort}`,
        description: `Initial work package for ${params.goal.slice(0, 60)}`,
        type: projectTypes[pi] ?? "setup",
        project_type: projectTypes[pi] ?? "setup",
        order_index: pi + 1,
        status: pi === 0 ? "active" : "pending",
        started_at: pi === 0 ? new Date() : null,
        trace_metadata: {
          ...buildTraceMetadata({
            layer: "project",
            parentId: initiationPhase.id,
            parentLayer: "phase",
            tier: params.tier,
            mode: params.mode,
            generationReason: `project_${pi}`,
          }),
          roleDistribution:
            params.mode === "team" ?
              { assigneeIds: [params.userId], container: "multi_user_project" }
            : { assigneeIds: [params.userId], container: "single_user_project" },
        },
      })
      .returning({ id: projects.id });
    if (!project) throw new TorgimaError("INTERNAL_ERROR", "Failed to create project");

    const actionsToCreate = actionTemplates.slice(0, tierRules.actionsPerProject);
    for (let ai = 0; ai < actionsToCreate.length; ai++) {
      const def = actionsToCreate[ai]!;
      await tx.insert(actions).values({
        blueprint_id: params.blueprintId,
        project_id: project.id,
        target_id: primaryTarget.id,
        user_id: params.userId,
        name: def.name,
        title: def.name,
        description: def.name,
        type: def.type,
        action_type: def.type,
        expected_output: `Completed ${def.type} output for: ${def.name}`,
        knowledge_category: def.category,
        order_index: ai + 1,
        status: "pending",
        trace_metadata: {
          ...buildTraceMetadata({
            layer: "action",
            parentId: project.id,
            parentLayer: "project",
            tier: params.tier,
            mode: params.mode,
            generationReason: `action_${def.type}`,
          }),
          roleLink:
            params.mode === "team" ?
              { assignedUserId: params.userId, roleLinkedWork: true }
            : { assignedUserId: params.userId, roleLinkedWork: false },
        },
      });
      actionCount++;
    }
  }

  if (tierRules.policyEnforcement !== "display") {
    await tx.insert(blueprintPolicies).values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      focus_statement: params.purpose ?? `Execute: ${goalShort}`,
      anti_focus: params.tier === "starter" ? "Avoid scope creep" : "Avoid unfocused expansion",
      rules: [
        { code: "SIGNAL_AUTHORITY", description: "Signals define truth — never overridden by AI" },
        { code: "CONDITION_AUTHORITY", description: "Condition controls execution posture" },
      ],
      enforcement_level: tierRules.policyEnforcement === "enforced" ? "strict" : "guidance",
      generated_from: { tier: params.tier, mode: params.mode },
      active: true,
    });
  }

  return {
    planId: primaryPlan.id,
    phaseId: initiationPhase.id,
    planCount: insertedPlans.length,
    phaseCount: insertedPhases.length,
    targetCount: insertedTargets.length,
    actionCount,
    seasonCount: seasonNames.length,
  };
}
