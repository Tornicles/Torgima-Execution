/**
 * IL4 / DOC_24 — score candidate tasks by value (not recency).
 */

export type PriorityCandidate = {
  id?: string;
  task_type: string;
  difficulty?: string | null;
};

export type PriorityContext = {
  condition: string;
  capability: { difficulty_recommendation?: string | null } | null;
  falseProgressActive: boolean;
};

export type ScoredPriorityCandidate = {
  candidate: PriorityCandidate;
  score: number;
};

const BASELINE = 50;

/** Pure scoring for unit tests (IL4 T2–T3, T5). */
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
  score(candidates: PriorityCandidate[], context: PriorityContext): PriorityCandidate {
    if (candidates.length === 0) {
      throw new Error("PriorityEngine: no candidates");
    }
    if (candidates.length === 1) return candidates[0]!;

    const scored: ScoredPriorityCandidate[] = candidates.map((candidate) => ({
      candidate,
      score: scorePriorityCandidate(candidate, context),
    }));

    scored.sort((a, b) => b.score - a.score || (a.candidate.id ?? "").localeCompare(b.candidate.id ?? ""));
    return scored[0]!.candidate;
  }

  scoreAll(candidates: PriorityCandidate[], context: PriorityContext): ScoredPriorityCandidate[] {
    return candidates
      .map((candidate) => ({
        candidate,
        score: scorePriorityCandidate(candidate, context),
      }))
      .sort((a, b) => b.score - a.score);
  }
}

export const priorityEngine = new PriorityEngine();
