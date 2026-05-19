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

export async function buildTierAwareBlueprintChain(
  tx: Tx,
  params: ChainBuildParams,
): Promise<ChainBuildResult> {
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
