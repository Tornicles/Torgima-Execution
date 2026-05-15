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

function pickTargetType(index: number, tier: BlueprintTier): (typeof TARGET_TYPES)[number] {
  if (tier === "starter") return "primary";
  return TARGET_TYPES[Math.min(index, TARGET_TYPES.length - 1)] ?? "primary";
}

export async function buildTierAwareBlueprintChain(
  tx: Tx,
  params: ChainBuildParams,
): Promise<ChainBuildResult> {
  const tierRules = getBlueprintTypeConfig(params.tier);
  const modeRules = getModeRules(params.mode);
  const goalShort = params.goal.slice(0, 60);

  const planDefs =
    params.pathSkeleton?.plans?.length ?
      params.pathSkeleton.plans.slice(0, tierRules.planCount)
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
        name: def.name,
        description: def.description,
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
    params.pathSkeleton?.targets?.length ?
      params.pathSkeleton.targets.slice(0, tierRules.targetCount)
    : Array.from({ length: tierRules.targetCount }, (_, i) => ({
        name:
          i === 0 ?
            `Primary target: ${params.goal.slice(0, 80)}`
          : `Supporting target ${i + 1}`,
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
        plan_id: insertedPlans[t % insertedPlans.length]!.id,
        owner_id: params.userId,
        contributor_ids: contributorIds,
        name: def.name,
        description: t === 0 ? params.goal : def.name,
        type: validType,
        order_index: t + 1,
        status: t === 0 ? "active" : "pending",
        trace_metadata: buildTraceMetadata({
          layer: "target",
          parentId: insertedPlans[t % insertedPlans.length]!.id,
          parentLayer: "plan",
          tier: params.tier,
          mode: params.mode,
          generationReason: `tier_${params.tier}_mode_${params.mode}_target_${t}`,
        }),
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

  const insertedPhases: { id: string; name: string }[] = [];
  for (const def of phaseDefinitions) {
    const [p] = await tx
      .insert(phases)
      .values({
        blueprint_id: params.blueprintId,
        target_id: primaryTarget.id,
        plan_id: primaryPlan.id,
        name: def.name,
        order_index: def.orderIndex,
        status: def.status,
        locked: def.locked,
        gate_passed: false,
        gate_criteria:
          tierRules.phaseGates ?
            { min_completion_rate: def.name === "initiation" ? 0.6 : 0.75, min_momentum: 40 }
          : { min_completion_rate: 0.5 },
        started_at: def.name === "initiation" ? new Date() : null,
        trace_metadata: buildTraceMetadata({
          layer: "phase",
          parentId: primaryTarget.id,
          parentLayer: "target",
          tier: params.tier,
          mode: params.mode,
          generationReason: `phase_${def.name}`,
        }),
      })
      .returning({ id: phases.id, name: phases.name });
    if (!p) throw new TorgimaError("INTERNAL_ERROR", `Failed to create phase: ${def.name}`);
    insertedPhases.push({ id: p.id, name: p.name });
  }

  const initiationPhase = insertedPhases.find((p) => p.name === "initiation") ?? insertedPhases[0]!;

  let actionCount = 0;
  const projectTypes = ["setup", "execution", "analysis", "optimization"] as const;
  const actionTemplates = [
    { name: "Define scope and success criteria", type: "analyze" as const },
    { name: "Identify immediate first steps", type: "create" as const },
    { name: "Establish baseline metrics", type: "measure" as const },
    { name: "Optimize execution leverage", type: "improve" as const },
  ];

  for (let pi = 0; pi < tierRules.projectsPerActivePhase; pi++) {
    const [project] = await tx
      .insert(projects)
      .values({
        blueprint_id: params.blueprintId,
        phase_id: initiationPhase.id,
        target_id: primaryTarget.id,
        owner_id: params.userId,
        assignee_ids: modeRules.distributedExecution ? [params.userId] : [],
        name:
          pi === 0 ?
            "Setup & Foundation"
          : `${projectTypes[pi] ?? "execution"} — ${goalShort}`,
        description: `Initial work package for ${params.goal.slice(0, 60)}`,
        type: projectTypes[pi] ?? "setup",
        order_index: pi + 1,
        status: pi === 0 ? "active" : "pending",
        started_at: pi === 0 ? new Date() : null,
        trace_metadata: buildTraceMetadata({
          layer: "project",
          parentId: initiationPhase.id,
          parentLayer: "phase",
          tier: params.tier,
          mode: params.mode,
          generationReason: `project_${pi}`,
        }),
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
        name: def.name,
        description: def.name,
        type: def.type,
        knowledge_category: params.tier === "starter" ? "execution" : "execution",
        order_index: ai + 1,
        status: "pending",
        trace_metadata: buildTraceMetadata({
          layer: "action",
          parentId: project.id,
          parentLayer: "project",
          tier: params.tier,
          mode: params.mode,
          generationReason: `action_${def.type}`,
        }),
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
