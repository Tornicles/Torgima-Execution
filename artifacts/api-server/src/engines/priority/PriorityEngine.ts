/**
 * IL4 / DOC_24 / Phase 5 — score candidate tasks by value (not recency).
 */

import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import {
  computeTaskValueScore,
  isRecoveryPriorityOverride,
  taskValueScoreToRank,
} from "./priorityScoring.js";
import {
  isDependencyBlocked,
  isDuplicateContentHash,
  isTaskTypeAllowed,
} from "./priorityExclusions.js";

export type PriorityCandidate = {
  id?: string;
  task_type: string;
  difficulty?: string | null;
  due_date?: string | Date | null;
  content_hash?: string | null;
};

export type PriorityContext = {
  condition: string;
  capability: { difficulty_recommendation?: string | null } | null;
  falseProgressActive: boolean;
};

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

export class PriorityEngine {
  /**
   * IL4 LAW 2 — single candidate returns immediately without comparative scoring.
   */
  /** IL4-compatible selection — legacy heuristic (see rankCandidates for Phase 5). */
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

  /**
   * Phase 5 — DOC 24 exclusion rules + formula scoring + recovery override.
   */
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
        void this.emitTaskGuaranteeIfAllExcluded(ctx);
        return {
          selected: null,
          scored: [{ candidate: only, score: 0, excluded: true, exclusionReason: excluded }],
          allExcluded: true,
        };
      }
      const score = this.scoreOne(only, ctx);
      return {
        selected: only,
        scored: [{ candidate: only, score }],
        allExcluded: false,
      };
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
      void this.emitTaskGuaranteeIfAllExcluded(ctx);
      return { selected: null, scored, allExcluded: true };
    }

    return { selected: eligible[0]!.candidate, scored, allExcluded: false };
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
    if (blockedIds && isDependencyBlocked(candidate, blockedIds)) {
      return "dependency_blocked";
    }
    if (recentHashes && isDuplicateContentHash(candidate, recentHashes)) {
      return "duplicate_content_hash";
    }
    return undefined;
  }

  private scoreOne(candidate: PriorityCandidate, ctx: PriorityContext): number {
    if (isRecoveryPriorityOverride(candidate, ctx.condition)) {
      return 100;
    }
    return taskValueScoreToRank(computeTaskValueScore(candidate, ctx));
  }

  private async emitTaskGuaranteeIfAllExcluded(ctx: RankCandidatesContext): Promise<void> {
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
}

export const priorityEngine = new PriorityEngine();
