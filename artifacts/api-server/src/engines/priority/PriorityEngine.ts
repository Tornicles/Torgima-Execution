/**
 * DOC24 — PriorityEngine orchestration, overrides, and selection API.
 */

import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { DecisionTraceService } from "../decision/DecisionTraceService.js";
import { getBlueprintStateVersion } from "../decision-trace/DecisionTraceSystem.js";
import {
  isDependencyBlocked,
  isDuplicateContentHash,
  isTaskTypeAllowed,
} from "./priorityExclusions.js";
import {
  score as scoreTaskValue,
  scoreDimensions,
  dependencyUnlockOverrideApplies,
  type CandidateTask,
  type TaskValueContext,
  TASK_VALUE_WEIGHTS,
} from "./TaskValueScorer.js";
import { isRecoveryPriorityOverride } from "./priorityScoring.js";

export type PriorityCandidate = CandidateTask;

export type PriorityContext = TaskValueContext;

export type ScoredPriorityCandidate = {
  candidate: PriorityCandidate;
  score: number;
  excluded?: boolean;
  exclusionReason?: string;
};

export type RankCandidatesContext = PriorityContext & {
  blueprintId: string;
  userId: string;
  allowedActions: string[];
  recentContentHashes?: Set<string>;
  dependencyBlockedOrderIds?: Set<string>;
  causationEventId?: string;
  forceRecovery?: boolean;
  activeTargetId?: string | null;
};

export type PriorityResult = {
  selectedTask: PriorityCandidate | null;
  score: number;
  reason:
    | "single_candidate"
    | "value_score"
    | "override_rule"
    | "all_blocked";
  requiresDependencyResolution?: boolean;
  overrideRule?: string;
  explanation?: string;
};

export type RankCandidatesResult = {
  selected: PriorityCandidate | null;
  scored: ScoredPriorityCandidate[];
  allExcluded: boolean;
};

const BASELINE = 50;

/** Pure scoring for unit tests (IL4 T2–T3, T5) — legacy heuristic. */
export function scorePriorityCandidate(
  order: PriorityCandidate,
  context: PriorityContext,
): number {
  let score = BASELINE;

  if (order.task_type === "blocker_resolution") score += 30;

  if (
    order.task_type === "recovery" &&
    ["danger", "nothingness"].includes(context.condition)
  ) {
    score += 20;
  }

  if (
    order.task_type === "execution" &&
    ["stability", "power", "affluence"].includes(context.condition)
  ) {
    score += 15;
  }

  if (
    order.task_type === "academy" &&
    context.capability?.difficulty_recommendation === "very_easy"
  ) {
    score += 20;
  }

  if (context.falseProgressActive && order.task_type === "execution") {
    score -= 25;
  }

  if (
    order.difficulty === "very_hard" &&
    context.capability?.difficulty_recommendation === "easy"
  ) {
    score -= 15;
  }

  return score;
}

export function filterExecutableCandidates(
  candidates: PriorityCandidate[],
  ctx: RankCandidatesContext,
): PriorityCandidate[] {
  const recentHashes = ctx.recentContentHashes ?? new Set<string>();
  const blockedIds = ctx.dependencyBlockedOrderIds ?? new Set<string>();

  return candidates.filter((candidate) => {
    if (!isTaskTypeAllowed(candidate.task_type, ctx.allowedActions)) return false;
    if (isDependencyBlocked(candidate, blockedIds)) return false;
    if (isDuplicateContentHash(candidate, recentHashes)) return false;
    return true;
  });
}

export function checkOverrideRules(
  executable: PriorityCandidate[],
  context: RankCandidatesContext,
): { task: PriorityCandidate; rule: string } | null {
  if (context.forceRecovery) {
    const recovery = executable.find((t) => t.task_type === "recovery");
    if (recovery) return { task: recovery, rule: "RECOVERY_OVERRIDE" };
  }

  const depUnlock = executable.find((t) => dependencyUnlockOverrideApplies(t));
  if (depUnlock) return { task: depUnlock, rule: "DEPENDENCY_OVERRIDE" };

  const phaseGate = executable.find(
    (t) => t.task_type === "phase_checkpoint" && t.phase_gate_due,
  );
  if (phaseGate) return { task: phaseGate, rule: "PHASE_GATE_OVERRIDE" };

  const criticalUnblock = executable.find(
    (t) => t.task_type === "blocker_resolution" && t.has_open_blocking_dependency,
  );
  if (criticalUnblock) return { task: criticalUnblock, rule: "CRITICAL_UNBLOCK_OVERRIDE" };

  if (["danger", "nothingness"].includes(context.condition)) {
    const recovery = executable.find((t) => t.task_type === "recovery");
    if (recovery) return { task: recovery, rule: "RECOVERY_CONDITION_OVERRIDE" };
  }

  return null;
}

export async function selectHighestValueTask(
  candidateTasks: PriorityCandidate[],
  context: RankCandidatesContext,
): Promise<PriorityResult> {
  if (candidateTasks.length === 0) {
    throw new Error("NO_CANDIDATES");
  }

  if (candidateTasks.length === 1) {
    return {
      selectedTask: candidateTasks[0]!,
      score: 0,
      reason: "single_candidate",
      explanation: "Only one candidate — priority is trivial.",
    };
  }

  const executable = filterExecutableCandidates(candidateTasks, context);
  if (executable.length === 0) {
    await emitTaskGuaranteeIfAllExcluded(context);
    return {
      selectedTask: null,
      score: 0,
      reason: "all_blocked",
      requiresDependencyResolution: true,
      explanation: "All candidates blocked — dependency resolution required.",
    };
  }

  const scored = executable
    .map((task) => ({ task, score: scoreTaskValue(task, context) }))
    .sort((a, b) => b.score - a.score || (a.task.id ?? "").localeCompare(b.task.id ?? ""));

  const override = checkOverrideRules(executable, context);
  if (override) {
    await writePriorityDecisionTrace(context, override.task, scored, override.rule);
    return {
      selectedTask: override.task,
      score: 100,
      reason: "override_rule",
      overrideRule: override.rule,
      explanation: `Override rule ${override.rule} selected ${override.task.task_type}.`,
    };
  }

  const selected = scored[0]!;
  await writePriorityDecisionTrace(context, selected.task, scored, "value_score");

  return {
    selectedTask: selected.task,
    score: selected.score,
    reason: "value_score",
    explanation: `Selected highest value task. Score: ${selected.score}/100`,
  };
}

async function writePriorityDecisionTrace(
  ctx: RankCandidatesContext,
  selected: PriorityCandidate,
  scored: Array<{ task: PriorityCandidate; score: number }>,
  reason: string,
): Promise<void> {
  if (!ctx.blueprintId || !ctx.userId || scored.length < 2) return;

  const stateVersion = await getBlueprintStateVersion(ctx.blueprintId).catch(() => 0);
  await DecisionTraceService.write({
    userId: ctx.userId,
    blueprintId: ctx.blueprintId,
    decisionType: "SYSTEM_GENERATION",
    decisionKey: "priority_selection",
    selectedOption: selected.id ?? selected.task_type,
    optionsConsidered: scored.map((s) => `${s.task.id ?? s.task.task_type}(${s.score})`),
    rationaleSummary: `Selected ${selected.task_type} via ${reason}. Score: ${scored[0]?.score ?? 0}/100`,
    sourceEngine: "PriorityEngine",
    confidence: "HIGH",
    stateVersion,
    causationEventId: ctx.causationEventId,
  }).catch(() => null);
}

async function emitTaskGuaranteeIfAllExcluded(ctx: RankCandidatesContext): Promise<void> {
  if (!ctx.blueprintId || !ctx.userId) return;
  await writeEvent({
    eventType: EVENT_TYPES.TASK_GUARANTEE_REQUESTED,
    entityType: "blueprint",
    entityId: ctx.blueprintId,
    userId: ctx.userId,
    blueprintId: ctx.blueprintId,
    payload: { reason: "all_priority_candidates_excluded", condition: ctx.condition },
    idempotencyKey: `priority_exhausted:${ctx.blueprintId}:${Math.floor(Date.now() / 60000)}`,
    causationEventId: ctx.causationEventId,
  }).catch(() => undefined);
}

export class PriorityEngine {
  score(candidates: PriorityCandidate[], context: PriorityContext): PriorityCandidate {
    if (candidates.length === 0) {
      throw new Error("PriorityEngine: no candidates");
    }
    if (candidates.length === 1) return candidates[0]!;
    return this.scoreAll(candidates, context)[0]!.candidate;
  }

  scoreAll(candidates: PriorityCandidate[], context: PriorityContext): ScoredPriorityCandidate[] {
    return candidates
      .map((candidate) => ({
        candidate,
        score: scorePriorityCandidate(candidate, context),
      }))
      .sort((a, b) => b.score - a.score);
  }

  rankCandidates(
    candidates: PriorityCandidate[],
    ctx: RankCandidatesContext,
  ): RankCandidatesResult {
    if (candidates.length === 0) {
      return { selected: null, scored: [], allExcluded: true };
    }

    if (candidates.length === 1) {
      const only = candidates[0]!;
      const excluded = this.getExclusionReason(only, ctx);
      if (excluded) {
        void emitTaskGuaranteeIfAllExcluded(ctx);
        return {
          selected: null,
          scored: [{ candidate: only, score: 0, excluded: true, exclusionReason: excluded }],
          allExcluded: true,
        };
      }
      return {
        selected: only,
        scored: [{ candidate: only, score: 0 }],
        allExcluded: false,
      };
    }

    const override = checkOverrideRules(filterExecutableCandidates(candidates, ctx), ctx);
    if (override) {
      const scored: ScoredPriorityCandidate[] = candidates.map((candidate) => {
        const exclusionReason = this.getExclusionReason(candidate, ctx);
        if (exclusionReason) {
          return { candidate, score: 0, excluded: true, exclusionReason };
        }
        return {
          candidate,
          score: candidate.id === override.task.id ? 100 : scoreTaskValue(candidate, ctx),
        };
      });
      void writePriorityDecisionTrace(ctx, override.task, scored.map((s) => ({
        task: s.candidate,
        score: s.score,
      })), override.rule);
      return { selected: override.task, scored, allExcluded: false };
    }

    const recentHashes = ctx.recentContentHashes ?? new Set<string>();
    const blockedIds = ctx.dependencyBlockedOrderIds ?? new Set<string>();

    const scored: ScoredPriorityCandidate[] = candidates.map((candidate) => {
      const exclusionReason = this.getExclusionReason(candidate, ctx, recentHashes, blockedIds);
      if (exclusionReason) {
        return { candidate, score: 0, excluded: true, exclusionReason };
      }
      return { candidate, score: this.scoreOne(candidate, ctx) };
    });

    const eligible = scored.filter((s) => !s.excluded);
    eligible.sort(
      (a, b) =>
        b.score - a.score || (a.candidate.id ?? "").localeCompare(b.candidate.id ?? ""),
    );

    if (eligible.length === 0) {
      void emitTaskGuaranteeIfAllExcluded(ctx);
      return { selected: null, scored, allExcluded: true };
    }

    void writePriorityDecisionTrace(ctx, eligible[0]!.candidate, eligible.map((s) => ({
      task: s.candidate,
      score: s.score,
    })), "value_score");

    return { selected: eligible[0]!.candidate, scored, allExcluded: false };
  }

  selectHighestValueTask(
    candidates: PriorityCandidate[],
    ctx: RankCandidatesContext,
  ): Promise<PriorityResult> {
    return selectHighestValueTask(candidates, ctx);
  }

  private getExclusionReason(
    candidate: PriorityCandidate,
    ctx: RankCandidatesContext,
    recentHashes?: Set<string>,
    blockedIds?: Set<string>,
  ): string | undefined {
    if (!isTaskTypeAllowed(candidate.task_type, ctx.allowedActions)) {
      return "outside_allowed_actions";
    }
    const blocked = blockedIds ?? ctx.dependencyBlockedOrderIds ?? new Set<string>();
    if (isDependencyBlocked(candidate, blocked)) {
      return "dependency_blocked";
    }
    const hashes = recentHashes ?? ctx.recentContentHashes ?? new Set<string>();
    if (isDuplicateContentHash(candidate, hashes)) {
      return "duplicate_content_hash";
    }
    return undefined;
  }

  private scoreOne(candidate: PriorityCandidate, ctx: PriorityContext): number {
    if (ctx.forceRecovery && candidate.task_type === "recovery") {
      return 100;
    }
    if (isRecoveryPriorityOverride(candidate, ctx.condition)) {
      return 100;
    }
    return scoreTaskValue(candidate, ctx);
  }
}

export const priorityEngine = new PriorityEngine();

export { TASK_VALUE_WEIGHTS, scoreTaskValue, scoreDimensions, dependencyUnlockOverrideApplies };
