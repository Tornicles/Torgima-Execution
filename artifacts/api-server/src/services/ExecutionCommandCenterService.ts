import {
  db,
  orders,
  orderDependencies,
  projectDependencies,
  validations,
  conditions,
  signalSnapshots,
  feedback,
  behaviorPatterns,
  pivotReviews,
} from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { ActionRow, OrderRow, PhaseRow, PlanRow, ProjectRow, TargetRow } from "../repositories/BlueprintRepository.js";
import { BlueprintRepository } from "../repositories/BlueprintRepository.js";
import {
  deriveExecutionIdentityLines,
  deriveOperationalAwarenessLines,
  deriveSignalBlueprintBridgeLines,
  type ConditionDetailLite,
  type SignalProjectionLite,
} from "../lib/operationalDerivation.js";

const DONE_ORDER_STATUS = ["completed", "skipped", "cancelled"];
const DONE_PROJECT_STATUS = ["complete", "skipped"];

function isDoneOrder(status: string): boolean {
  return DONE_ORDER_STATUS.includes(status);
}

function isDoneProject(status: string): boolean {
  return DONE_PROJECT_STATUS.includes(status);
}

function phaseIsTerminal(status: string): boolean {
  return status === "complete" || status === "skipped";
}

function asRecord(val: unknown): Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val) ? (val as Record<string, unknown>) : {};
}

function pickIntelStrings(intel: Record<string, unknown>): {
  blueprintSeeding: string | null;
  executionImplication: string | null;
  strongestAngle: string | null;
  weakestAngle: string | null;
  primaryWarnings: string[];
  strategicEmphasis: string[];
} {
  const blueprintSeeding =
    typeof intel.blueprintSeedingInstructions === "string"
      ? intel.blueprintSeedingInstructions
      : typeof intel.blueprint_seed_instructions === "string"
        ? (intel.blueprint_seed_instructions as string)
        : null;

  let executionImplication = typeof intel.executionImplication === "string" ? intel.executionImplication : null;
  let strongestAngle: string | null = typeof intel.strongestAngle === "string" ? intel.strongestAngle : null;
  let weakestAngle: string | null = null;
  let primaryWarnings: string[] = [];

  const nested = intel.realityIntelligence ?? intel.reality_intelligence;
  if (nested && typeof nested === "object") {
    const r = nested as Record<string, unknown>;
    executionImplication =
      executionImplication ?? (typeof r.executionImplication === "string" ? r.executionImplication : null);

    const pos = r.positioning;
    if (pos && typeof pos === "object") {
      const p = pos as Record<string, unknown>;
      strongestAngle = strongestAngle ?? (typeof p.strongestAngle === "string" ? p.strongestAngle : null);
      weakestAngle = typeof p.weakestAngle === "string" ? p.weakestAngle : null;
    }

    const ws = r.strategicWarnings ?? r.strategic_warnings;
    if (Array.isArray(ws)) {
      primaryWarnings = ws.filter((x) => typeof x === "string") as string[];
    }

    const wspace = r.whiteSpace ?? r.white_space;
    if (wspace && typeof wspace === "object") {
      const w = wspace as Record<string, unknown>;
      const gaps = w.executionGaps ?? w.execution_gaps;
      if (Array.isArray(gaps)) {
        for (const g of gaps) {
          if (typeof g === "string") primaryWarnings.push(`Execution gap: ${g}`);
        }
      }
    }
  }

  const emphasis: string[] = [];
  if (weakestAngle) emphasis.push(`Vulnerability surfaced in intelligence: ${weakestAngle}`);
  if (blueprintSeeding) emphasis.push(`Seeding posture: ${blueprintSeeding}`);

  return {
    blueprintSeeding,
    executionImplication,
    strongestAngle,
    weakestAngle,
    primaryWarnings,
    strategicEmphasis: emphasis.slice(0, 10),
  };
}

export interface OrderTraceDTO {
  orderId: string;
  title: string;
  status: string;
  proofRequired: boolean;
  upstream: {
    goal: string;
    planId: string | null;
    planName: string | null;
    targetId: string | null;
    targetName: string | null;
    phaseId: string | null;
    phaseName: string | null;
    projectId: string | null;
    projectName: string | null;
    actionId: string | null;
    actionName: string | null;
  };
  downward: {
    whyItMatters: string | null;
    generationReason: string | null;
    conditionAtGeneration: string | null;
  };
  lockReasons: string[];
}

export interface ExecutionHierarchyActionDTO {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  locked: boolean;
  lockNotes: string[];
  progressOrders: {
    completed: number;
    total: number;
  };
  orders: OrderTraceDTO[];
}

export interface ExecutionHierarchyProjectDTO {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  blockedFlag: boolean;
  blockedReason: string | null;
  locked: boolean;
  lockNotes: string[];
  actions: ExecutionHierarchyActionDTO[];
}

export interface ExecutionHierarchyPhaseDTO {
  id: string;
  name: string;
  status: string;
  lockedDb: boolean;
  gatePassed: boolean;
  unlockRequirements: string[];
  strategicPurpose: string;
  progressionPctOrders: number;
  projects: ExecutionHierarchyProjectDTO[];
  signalsApply: string;
}

export interface ExecutionHierarchyPlanDTO {
  id: string;
  name: string;
  description: string | null;
  status: string;
  purposeLine: string;
  unlockSummary: string;
  failureImpact: string;
  completionPct: number;
  linkedTargetIds: string[];
  phases: ExecutionHierarchyPhaseDTO[];
}

export interface DependencyEdge {
  relation: "BLOCKS_ORDER" | "BLOCKS_PROJECT";
  blockingId: string;
  blockingLabel: string;
  blockedId: string;
  blockedLabel: string;
}

export interface ExecutionTargetDTO {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  currentValue: number;
  targetValue: number | null;
  unit: string | null;
  progress: number;
  planId: string | null;
  planName: string | null;
  linkedPhaseIds: string[];
  linkedProjectIds: string[];
  emphasis: string[];
  riskState: string;
  whyMatters: string;
  consequenceIfMissed: string;
  unlockHint: string;
}

export interface ExecutionCommandCenterDTO {
  blueprintId: string;
  blueprintStatus: string;
  blueprintType: {
    tier: string | null;
    mode: string | null;
    intelligenceDepth: string | null;
    allowedSystems: string[];
    lockedSystems: string[];
  };
  pausedAt: string | null;
  pauseReason: string | null;
  /** Orders with no `action_id` — still traced to blueprint, not shown under an action row. */
  detachedOrders: OrderTraceDTO[];
  mission: {
    rawGoal: string;
    purpose: string | null;
    strategicIntentSummary: string | null;
    domain: string | null;
    timeframeLabel: string | null;
    currentCondition: string | null;
    executionStatus: string;
    progressionSummary: string;
    momentumSummary: string;
    executionImplication: string | null;
    strongestAngle: string | null;
    biggestVulnerability: string | null;
    primaryStrategicWarnings: string[];
  };
  policies: Array<{ code: string; description: string; source: string }>;
  hierarchy: ExecutionHierarchyPlanDTO[];
  targets: ExecutionTargetDTO[];
  dependencyEdges: DependencyEdge[];
  signalBridge: { lines: Array<{ headline: string; cite: string }> };
  strategicContinuity: {
    validationVerdict: string | null;
    validationSummary: string | null;
    selectedPath: string | null;
    intelligenceEmphasis: string[];
    seedingInstructionsVisible: string | null;
  };
  ownership: { lines: string[] };
  operationalAwareness: string[];
}

function weakestMatchesTarget(targetName: string, weakest: string | null): boolean {
  if (!weakest) return false;
  const parts = targetName.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  const wlow = weakest.toLowerCase();
  return parts.some((p) => wlow.includes(p));
}

export async function getExecutionCommandCenter(blueprintId: string, userId: string): Promise<ExecutionCommandCenterDTO> {
  const chain = await BlueprintRepository.findBlueprintWithChain(blueprintId, userId);
  const { blueprint, plans: planRows, phases: phaseRows, targets: targetRows, projects: projectRows, actions: actionRows } =
    chain;

  const sortedPhases = [...phaseRows].sort((a, b) => a.order_index - b.order_index);

  const [
    orderRows,
    odRows,
    pdRows,
    validationRow,
    conditionRows,
    snapRow,
    patternRow,
    openPivot,
  ] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(and(eq(orders.blueprint_id, blueprintId), eq(orders.user_id, userId)))
      .orderBy(desc(orders.created_at))
      .limit(250),
    db.select().from(orderDependencies).where(eq(orderDependencies.blueprint_id, blueprintId)),
    db.select().from(projectDependencies).where(eq(projectDependencies.blueprint_id, blueprintId)),
    db
      .select()
      .from(validations)
      .where(and(eq(validations.blueprint_id, blueprintId), eq(validations.user_id, userId)))
      .orderBy(desc(validations.created_at))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select()
      .from(conditions)
      .where(eq(conditions.blueprint_id, blueprintId))
      .orderBy(desc(conditions.entered_at))
      .limit(4),
    db
      .select()
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)))
      .limit(1)
      .then((r) => r[0] ?? null),

    db
      .select({ pattern_type: behaviorPatterns.pattern_type })
      .from(behaviorPatterns)
      .where(and(eq(behaviorPatterns.user_id, userId), eq(behaviorPatterns.blueprint_id, blueprintId)))
      .orderBy(desc(behaviorPatterns.last_detected_at))
      .limit(1)
      .then((r) => r[0] ?? null),

    db
      .select({ id: pivotReviews.id })
      .from(pivotReviews)
      .where(
        and(
          eq(pivotReviews.blueprint_id, blueprintId),
          eq(pivotReviews.user_id, userId),
          eq(pivotReviews.status, "open"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);

  const currentConditionRow = chain.condition ?? conditionRows[0] ?? null;
  const priorConditionRow = currentConditionRow
    ? (conditionRows.find((c) => c.id !== currentConditionRow!.id) ?? null)
    : null;

  const enforcement = chain.enforcement;
  const enforcementPermission = enforcement?.phase_permission ?? null;
  const difficultyCap = enforcement?.difficulty_cap ?? null;

  const signalProj: SignalProjectionLite | null = snapRow
    ? {
        completionRate: Number(snapRow.completion_rate),
        weightedScore: Number(snapRow.weighted_score),
        momentum: Number(snapRow.momentum),
        trend: snapRow.trend ?? null,
        confidence: snapRow.confidence ?? null,
        blockerRatio: snapRow.blocker_ratio != null ? Number(snapRow.blocker_ratio) : null,
        skipRatio: snapRow.skip_ratio != null ? Number(snapRow.skip_ratio) : null,
      }
    : null;

  const conditionLite: ConditionDetailLite | null = currentConditionRow
    ? {
        condition: currentConditionRow.condition,
        durationDays: currentConditionRow.duration_days,
        recoveryRequired: currentConditionRow.recovery_required,
        escalationLevel: currentConditionRow.escalation_level,
        transitionReason: currentConditionRow.transition_reason ?? null,
        previousCondition: currentConditionRow.previous_condition ?? priorConditionRow?.condition ?? null,
      }
    : null;

  const intel = pickIntelStrings(
    asRecord((chain.blueprint as { intel_metadata?: unknown }).intel_metadata ?? {}),
  );
  const valSummary = validationRow?.ai_summary ?? null;
  const pathCurrentUnknown = validationRow?.path_current as Record<string, unknown> | null | undefined;
  const vulFromValidation =
    pathCurrentUnknown && typeof pathCurrentUnknown.weakestAngle === "string" ?
      pathCurrentUnknown.weakestAngle
    : pathCurrentUnknown && typeof pathCurrentUnknown.weakest_angle === "string" ?
      pathCurrentUnknown.weakest_angle
    : null;

  const timeframeLabel = (() => {
    const a = blueprint.timeframe_start;
    const b = blueprint.timeframe_end;
    if (a && b) return `${Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000))}-day horizon`;
    return null;
  })();

  const domain = blueprint.current_domain ?? blueprint.domain_hint ?? null;

  const progressionSummary = (() => {
    if (phaseRows.length === 0) return "No phases persisted for this blueprint yet.";
    const done = phaseRows.filter((p) => phaseIsTerminal(p.status)).length;
    return `${done} / ${phaseRows.length} phases terminal (complete or skipped).`;
  })();

  const momentumSummary = snapRow
    ? `Snapshot trend ${snapRow.trend}, confidence ${snapRow.confidence}, momentum integer ${snapRow.momentum}.`
    : "No current signal snapshot attached to blueprint.";

  const missionStrategicIntent = valSummary ?? intel.executionImplication ?? intel.blueprintSeeding ?? null;

  const policies: ExecutionCommandCenterDTO["policies"] = [
    {
      code: "REALITY_PRIMARY",
      description: "Reality from signals + feedback overrides narrative assumptions.",
      source: "control.doctrine",
    },
    {
      code: "DEPENDENCIES_BLOCK",
      description: "Unresolved dependencies retain lock — execution cannot bypass prerequisites.",
      source: "dependency.engine",
    },
    {
      code: "PROOF_GATE",
      description: "Orders marked proof-required remain illegitimate until valid feedback + proof payloads exist.",
      source: "order.enforcement",
    },
  ];

  if (enforcement) {
    for (const a of enforcement.allowed_actions ?? []) {
      policies.push({
        code: `ALLOWED_ACTION:${a}`,
        description: `Action family permitted under current package: ${a}`,
        source: "enforcement.allowed_actions",
      });
    }
    for (const b of enforcement.blocked_actions ?? []) {
      policies.push({
        code: `BLOCKED_ACTION:${b}`,
        description: `Action family withheld under current package: ${b}`,
        source: "enforcement.blocked_actions",
      });
    }
    policies.push({
      code: `DIFFICULTY_CAP:${enforcement.difficulty_cap}`,
      description: `Maximum difficulty tier for emitted orders — ${enforcement.difficulty_cap}.`,
      source: "enforcement.difficulty_cap",
    });
    if (enforcement.target_adjustment) {
      policies.push({
        code: `TARGET_ADJUST:${enforcement.target_adjustment}`,
        description: `Target pressure adjustment — ${enforcement.target_adjustment}.`,
        source: "enforcement.target_adjustment",
      });
    }
    policies.push({
      code: `PHASE_PERM:${enforcement.phase_permission}`,
      description: `Phase motion permission — ${enforcement.phase_permission}.`,
      source: "enforcement.phase_permission",
    });
    if (enforcement.ai_mode) {
      policies.push({
        code: `AI_MODE:${enforcement.ai_mode}`,
        description: `AI generation posture — ${enforcement.ai_mode} (Bhudhi explains; control assigns conditions).`,
        source: "enforcement.ai_mode",
      });
    }
  }

  const ordersByAction = new Map<string, OrderRow[]>();
  for (const o of orderRows) {
    if (!o.action_id) continue;
    const list = ordersByAction.get(o.action_id) ?? [];
    list.push(o);
    ordersByAction.set(o.action_id, list);
  }

  const orderById = new Map(orderRows.map((o) => [o.id, o]));
  const projectById = new Map(projectRows.map((p) => [p.id, p]));
  const phaseById = new Map(phaseRows.map((p) => [p.id, p]));
  const targetById = new Map(targetRows.map((t) => [t.id, t]));
  const planById = new Map(planRows.map((p) => [p.id, p]));

  function blockingOrdersFor(orderId: string) {
    return odRows.filter((d) => d.blocked_order_id === orderId);
  }

  function orderLockMessages(o: OrderRow): string[] {
    const msgs: string[] = [];
    for (const dep of blockingOrdersFor(o.id)) {
      const blk = orderById.get(dep.blocking_order_id);
      if (blk && !isDoneOrder(blk.status)) {
        msgs.push(`Order dependency: finish "${blk.title}" before this order.`);
      }
    }
    if (o.linked_phase_id) {
      const ph = phaseById.get(o.linked_phase_id);
      if (ph?.locked) msgs.push(`Phase "${ph.name}" is locked in database — prior progression required.`);
    }
    return msgs;
  }

  function projectLockMessages(projectId: string): string[] {
    const msgs: string[] = [];
    const proj = projectById.get(projectId);
    if (proj?.is_blocked && proj.blocked_reason) msgs.push(`Project blocked: ${proj.blocked_reason}`);
    for (const dep of pdRows.filter((d) => d.blocked_project_id === projectId)) {
      const blk = projectById.get(dep.blocking_project_id);
      if (blk && !isDoneProject(blk.status)) {
        msgs.push(`Project dependency: finish "${blk.name}" first.`);
      }
    }
    return msgs;
  }

  function phaseStructuralLocks(ph: PhaseRow): string[] {
    const idx = sortedPhases.findIndex((p) => p.id === ph.id);
    if (idx <= 0) return [];
    const msgs: string[] = [];
    for (let i = 0; i < idx; i++) {
      const prior = sortedPhases[i]!;
      if (!phaseIsTerminal(prior.status)) msgs.push(`Prior phase not terminal: ${prior.name} (${prior.status}).`);
    }
    return msgs;
  }

  function phaseLockedOperational(ph: PhaseRow): boolean {
    return ph.locked || phaseStructuralLocks(ph).length > 0;
  }

  function buildOrderTrace(o: OrderRow): OrderTraceDTO {
    const action = o.action_id ? actionRows.find((a) => a.id === o.action_id) ?? null : null;
    const project = action ? projectRows.find((p) => p.id === action.project_id) ?? null : null;
    const phaseId = o.linked_phase_id ?? project?.phase_id ?? null;
    const phase = phaseId ? phaseById.get(phaseId) ?? null : null;
    const planId = o.linked_plan_id ?? phase?.plan_id ?? null;
    const plan = planId ? planById.get(planId) ?? null : null;
    const targetId = o.linked_target_id ?? project?.target_id ?? action?.target_id ?? phase?.target_id ?? null;
    const target = targetId ? targetById.get(targetId) ?? null : null;

    return {
      orderId: o.id,
      title: o.title,
      status: o.status,
      proofRequired: o.proof_required,
      upstream: {
        goal: blueprint.goal,
        planId: plan?.id ?? null,
        planName: plan?.name ?? null,
        targetId: target?.id ?? null,
        targetName: target?.name ?? null,
        phaseId: phase?.id ?? null,
        phaseName: phase?.name ?? null,
        projectId: project?.id ?? null,
        projectName: project?.name ?? null,
        actionId: action?.id ?? null,
        actionName: action?.name ?? null,
      },
      downward: {
        whyItMatters: o.why_it_matters ?? null,
        generationReason: o.generation_reason ?? null,
        conditionAtGeneration: o.condition_at_generation ?? null,
      },
      lockReasons: orderLockMessages(o),
    };
  }

  function buildProjectsForPhase(ph: PhaseRow): ExecutionHierarchyProjectDTO[] {
    const projList = projectRows.filter((pj) => pj.phase_id === ph.id).sort((a, b) => a.order_index - b.order_index);
    const structLocks = phaseStructuralLocks(ph);

    return projList.map((pj: ProjectRow): ExecutionHierarchyProjectDTO => {
      const pjLocks = projectLockMessages(pj.id);
      const acts = actionRows.filter((a) => a.project_id === pj.id).sort((a, b) => a.order_index - b.order_index);

      const lockedProj =
        pjLocks.length > 0 || pj.is_blocked || ph.locked || structLocks.length > 0 || phaseLockedOperational(ph);

      const actionsPayload: ExecutionHierarchyActionDTO[] = acts.map((ac: ActionRow): ExecutionHierarchyActionDTO => {
        const ordList = [...(ordersByAction.get(ac.id) ?? [])].slice(0, 30);
        const completedOrds = ordList.filter((ord) => isDoneOrder(ord.status)).length;
        let lockNotes: string[] = [...pjLocks, ...structLocks];
        if (ph.locked) lockNotes.push("Phase flagged `locked` in schema.");
        for (const ox of ordList) lockNotes.push(...orderLockMessages(ox));
        lockNotes = [...new Set(lockNotes)];

        return {
          id: ac.id,
          name: ac.name,
          description: ac.description ?? null,
          type: ac.type,
          status: ac.status,
          locked: lockNotes.length > 0 || ph.locked || structLocks.length > 0 || phaseLockedOperational(ph),
          lockNotes,
          progressOrders: {
            completed: completedOrds,
            total: Math.max(ordList.length, 1),
          },
          orders: ordList.map(buildOrderTrace),
        };
      });

      const lockNotesMerged = [...new Set([...pjLocks, ...structLocks])];

      return {
        id: pj.id,
        name: pj.name,
        description: pj.description ?? null,
        type: pj.type,
        status: pj.status,
        blockedFlag: pj.is_blocked,
        blockedReason: pj.blocked_reason ?? null,
        locked: lockedProj,
        lockNotes: lockNotesMerged,
        actions: actionsPayload,
      };
    });
  }

  function buildPhasePayload(planPhases: PhaseRow[]): ExecutionHierarchyPhaseDTO[] {
    return planPhases.map((ph) => {
      const projectsPayload = buildProjectsForPhase(ph);
      const phaseOrdersAll = orderRows.filter((o) => o.linked_phase_id === ph.id);
      const completedPhaseOrders = phaseOrdersAll.filter((o) => isDoneOrder(o.status)).length;
      const progressionPctOrders =
        phaseOrdersAll.length === 0 ?
          phaseIsTerminal(ph.status) ? 100
          : ph.status === "active" ? 0
          : 0
        : Math.round((completedPhaseOrders / phaseOrdersAll.length) * 100);

      const unlockReq = [...new Set([...(ph.locked ? ["Phase field `locked` is true in database."] : []), ...phaseStructuralLocks(ph)])];

      const strategicPurpose =
        intel.blueprintSeeding != null ?
          `Blueprint seeding text (stored): ${intel.blueprintSeeding.slice(0, 280)}`
        : "Phase gates proof density before scope expansion — structure is deterministic; intelligence only narrates emphasis.";

      return {
        id: ph.id,
        name: ph.name,
        status: ph.status,
        lockedDb: ph.locked,
        gatePassed: ph.gate_passed,
        unlockRequirements: unlockReq,
        strategicPurpose,
        progressionPctOrders,
        projects: projectsPayload,
        signalsApply:
          snapRow ?
            `All plans share this blueprint’s current snapshot (trend ${snapRow.trend}, confidence ${snapRow.confidence}).`
          : "Signals not yet hydrated for this blueprint — worker will attach snapshots after feedback loops.",
      };
    });
  }

  const hierarchy: ExecutionHierarchyPlanDTO[] = [];

  for (const plan of planRows) {
    const planPhases = sortedPhases.filter((p) => p.plan_id === plan.id);

    const phasePayloads = buildPhasePayload(planPhases);
    const donePh = phasePayloads.filter((p) => phaseIsTerminal(p.status)).length;
    const totalPh = phasePayloads.length || 1;
    const completionPct = Math.round((donePh / totalPh) * 100);

    const linkedTargetIds = targetRows.filter((t: TargetRow) => t.plan_id === plan.id).map((t) => t.id);

    hierarchy.push({
      id: plan.id,
      name: plan.name,
      description: plan.description ?? null,
      status: plan.status,
      purposeLine: plan.description ?? intel.executionImplication ?? "Plan sequences proof obligations tied to blueprint activation.",
      unlockSummary: `${donePh} / ${totalPh} phases terminal · ${linkedTargetIds.length} targets linked.`,
      failureImpact:
        intel.primaryWarnings[0] ?? "Stalled plans degrade signal certainty and may tighten enforcement.",
      completionPct,
      linkedTargetIds,
      phases: phasePayloads,
    });
  }

  const orphanPlanPhases = sortedPhases.filter((p) => !p.plan_id);
  if (orphanPlanPhases.length > 0) {
    const phasePayloads = buildPhasePayload(orphanPlanPhases);
    const donePh = phasePayloads.filter((p) => phaseIsTerminal(p.status)).length;
    const totalPh = phasePayloads.length || 1;
    hierarchy.push({
      id: `orphan-structure-${blueprintId}`,
      name: "Structural phases",
      description: "Phases not linked to a plan row (`plan_id` null) — still active in progression.",
      status: "pending",
      purposeLine: "Carries initiation / recovery phases when activation did not associate a plan FK.",
      unlockSummary: `${donePh} / ${totalPh} phases terminal.`,
      failureImpact:
        intel.primaryWarnings[1] ?? "Orphan phases still gate orders — progression depends on their terminal proofs.",
      completionPct: Math.round((donePh / totalPh) * 100),
      linkedTargetIds: [],
      phases: phasePayloads,
    });
  }

  const targetsOut: ExecutionTargetDTO[] = targetRows.map((t: TargetRow) => {
    const phasesFor = phaseRows.filter((p) => p.target_id === t.id);
    const projsFor = projectRows.filter((p) => p.target_id === t.id);
    const pl = t.plan_id ? planById.get(t.plan_id) : null;
    const emphasis = [...intel.strategicEmphasis];
    if (weakestMatchesTarget(t.name, intel.weakestAngle)) emphasis.unshift("Intelligence vulnerability string intersects target name — escalate proof.");

    return {
      id: t.id,
      name: t.name,
      description: t.description ?? null,
      type: t.type,
      status: t.status,
      currentValue: Number(t.current_value),
      targetValue: t.target_value != null ? Number(t.target_value) : null,
      unit: t.unit ?? null,
      progress: Number(t.progress),
      planId: t.plan_id,
      planName: pl?.name ?? null,
      linkedPhaseIds: phasesFor.map((p) => p.id),
      linkedProjectIds: projsFor.map((p) => p.id),
      emphasis,
      riskState:
        t.status === "at_risk" ? "at_risk" : t.progress < 0.35 && t.status !== "complete" ? "watch" : "stable",
      whyMatters: "Targets define measurable reality checks — signals and enforcement compare execution against them.",
      consequenceIfMissed: "Missed targets keep gates closed and may trigger recovery conditioning.",
      unlockHint: "Close dependent projects and submit proof-backed feedback to move the metric.",
    };
  });

  const dependencyEdges: DependencyEdge[] = [];
  for (const d of odRows) {
    const a = orderById.get(d.blocking_order_id);
    const b = orderById.get(d.blocked_order_id);
    if (a && b)
      dependencyEdges.push({
        relation: "BLOCKS_ORDER",
        blockingId: a.id,
        blockingLabel: a.title,
        blockedId: b.id,
        blockedLabel: b.title,
      });
  }
  for (const d of pdRows) {
    const a = projectById.get(d.blocking_project_id);
    const b = projectById.get(d.blocked_project_id);
    if (a && b)
      dependencyEdges.push({
        relation: "BLOCKS_PROJECT",
        blockingId: a.id,
        blockingLabel: a.name,
        blockedId: b.id,
        blockedLabel: b.name,
      });
  }

  const pivotOpen = Boolean(openPivot);

  let signalBridgeLines = conditionLite
    ? deriveSignalBlueprintBridgeLines({
        condition: conditionLite,
        signalProjection: signalProj,
        enforcementPhasePermission: enforcementPermission,
        difficultyCap,
        pivotReviewOpen: pivotOpen,
      })
    : [];

  if (signalBridgeLines.length === 0 && signalProj) {
    const cr = Math.round(signalProj.completionRate * 1000) / 10;
    signalBridgeLines = [
      {
        headline: `Signal window (no condition row loaded): completion ${cr}%, trend ${signalProj.trend ?? "unknown"}.`,
        cite: "Persisted metrics on current signal_snapshots row for this blueprint.",
      },
    ];
  }

  const detachedOrders = orderRows.filter((o) => !o.action_id).map(buildOrderTrace);

  const lockedPhaseOperationalCount = sortedPhases.filter((p) => phaseLockedOperational(p) && !phaseIsTerminal(p.status)).length;

  const blockedOrders = orderRows.filter((o) => o.status === "blocked");

  const operationalAwareness = deriveOperationalAwarenessLines({
    condition: conditionLite,
    signalProjection: signalProj,
    enforcementPhasePermission: enforcementPermission,
    pivotReviewOpen: pivotOpen,
    hasBlockedOrders: blockedOrders.length > 0,
    lockedPhaseCount: lockedPhaseOperationalCount,
  });

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [fbWeek] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(feedback)
    .where(and(eq(feedback.blueprint_id, blueprintId), eq(feedback.user_id, userId), gte(feedback.created_at, weekAgo)));

  const [doneCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.blueprint_id, blueprintId), eq(orders.user_id, userId), eq(orders.status, "completed")));

  const ownershipLines = deriveExecutionIdentityLines({
    momentumStreakDays: snapRow?.momentum ?? 0,
    feedbackCyclesThisWeek: fbWeek?.n ?? 0,
    completedOrdersAllTime: doneCount?.n ?? 0,
    operatingPattern: patternRow?.pattern_type ?? null,
  });

  const blueprintConfig = (blueprint.blueprint_config ?? {}) as {
    tierRules?: { allowedSystems?: string[]; lockedSystems?: string[] };
  };

  return {
    blueprintId,
    blueprintStatus: blueprint.status,
    blueprintType: {
      tier: blueprint.tier ?? null,
      mode: blueprint.mode ?? null,
      intelligenceDepth: blueprint.intelligence_depth ?? null,
      allowedSystems: blueprintConfig.tierRules?.allowedSystems ?? [],
      lockedSystems: blueprintConfig.tierRules?.lockedSystems ?? [],
    },
    pausedAt: blueprint.paused_at ? blueprint.paused_at.toISOString() : null,
    pauseReason: blueprint.pause_reason,
    detachedOrders,
    mission: {
      rawGoal: blueprint.goal,
      purpose: blueprint.purpose ?? null,
      strategicIntentSummary: missionStrategicIntent,
      domain,
      timeframeLabel,
      currentCondition: currentConditionRow?.condition ?? blueprint.current_condition ?? null,
      executionStatus: blueprint.status,
      progressionSummary,
      momentumSummary,
      executionImplication: intel.executionImplication,
      strongestAngle: intel.strongestAngle,
      biggestVulnerability: intel.weakestAngle ?? vulFromValidation,
      primaryStrategicWarnings: intel.primaryWarnings.slice(0, 8),
    },
    policies,
    hierarchy:
      hierarchy.length > 0 ?
        hierarchy.map((hp) =>
          hp.phases.length === 0 ?
            {
              ...hp,
              phases: [
                {
                  id: `empty-phase-${hp.id}`,
                  name: emptyPhaseName(planRows.find((pr) => pr.id === hp.id)),
                  status: "pending",
                  lockedDb: false,
                  gatePassed: false,
                  unlockRequirements: ["No persisted phases mapped to this plan — activation may still be hydrating."],
                  strategicPurpose:
                    hp.purposeLine ?? "Awaiting hydration from blueprint activation or manual repair.",
                  progressionPctOrders: 0,
                  projects: [],
                  signalsApply:
                    snapRow ? `Inherited blueprint snapshot (${snapRow.trend})` : "No snapshot.",
                },
              ],
            }
          : hp,
        )
      : [
          {
            id: `no-plans-${blueprintId}`,
            name: "Execution chain pending",
            description: "No plans found — onboarding may still be finalizing blueprint generation.",
            status: "pending",
            purposeLine: missionStrategicIntent ?? "Hydrate blueprint from activation pathway.",
            unlockSummary: "No plan rows; nothing to unlock until chain exists.",
            failureImpact: "Execution cannot attach orders to plan/phase metadata until chain materializes.",
            completionPct: 0,
            linkedTargetIds: [],
            phases: [
              {
                id: `empty-${blueprintId}`,
                name: "No phases",
                status: "pending",
                lockedDb: true,
                gatePassed: false,
                unlockRequirements: ["Blueprint chain must be generated (activate + validate path)."],
                strategicPurpose: "Structural placeholder until database contains plan / phase entities.",
                progressionPctOrders: 0,
                projects: [],
                signalsApply: snapRow ? `${snapRow.trend}` : "Awaiting signal worker.",
              },
            ],
          },
        ],
    targets: targetsOut,
    dependencyEdges,
    signalBridge: { lines: signalBridgeLines },
    strategicContinuity: {
      validationVerdict: validationRow?.verdict ?? null,
      validationSummary: valSummary,
      selectedPath: validationRow?.selected_path ?? null,
      intelligenceEmphasis: intel.strategicEmphasis,
      seedingInstructionsVisible: intel.blueprintSeeding,
    },
    ownership: { lines: ownershipLines },
    operationalAwareness,
  };
}

function emptyPhaseName(plan: PlanRow | undefined): string {
  return plan ? `No phases for plan “${plan.name}”` : "No phases";
}

export const ExecutionCommandCenterService = {
  get: getExecutionCommandCenter,
};
