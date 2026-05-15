/**
 * Prompt 7 §7 — historical validation persistence per user/goal.
 */

import { db, validationMemory } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "crypto";

export function goalFingerprint(rawGoal: string, domainHints?: string[]): string {
  const base = `${rawGoal.trim().toLowerCase()}|${(domainHints ?? []).join(",")}`;
  return createHash("sha256").update(base).digest("hex").slice(0, 32);
}

export async function recordValidationMemory(params: {
  userId: string;
  blueprintId: string;
  validationId: string;
  rawGoal: string;
  domainHints?: string[];
  verdict?: string | null;
  clarityScore?: number | null;
  feasibilityScore?: number | null;
  realismScore?: number | null;
  industryLabel?: string | null;
  selectedPath?: string | null;
  payload?: Record<string, unknown>;
}): Promise<string> {
  const goalHash = goalFingerprint(params.rawGoal, params.domainHints);
  const [row] = await db
    .insert(validationMemory)
    .values({
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      validation_id: params.validationId,
      goal_hash: goalHash,
      raw_goal_snapshot: params.rawGoal.slice(0, 2000),
      verdict: params.verdict ?? null,
      clarity_score: params.clarityScore ?? null,
      feasibility_score: params.feasibilityScore ?? null,
      realism_score: params.realismScore ?? null,
      industry_label: params.industryLabel ?? null,
      selected_path: params.selectedPath ?? null,
      payload_json: params.payload ?? {},
    })
    .returning({ id: validationMemory.id });
  return row?.id ?? "";
}

export async function getValidationHistory(params: {
  userId: string;
  goalHash?: string;
  limit?: number;
}) {
  const conds = [eq(validationMemory.user_id, params.userId)];
  if (params.goalHash) conds.push(eq(validationMemory.goal_hash, params.goalHash));

  return db
    .select()
    .from(validationMemory)
    .where(and(...conds))
    .orderBy(desc(validationMemory.created_at))
    .limit(params.limit ?? 10);
}
