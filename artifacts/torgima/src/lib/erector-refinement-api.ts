import { apiFetchEnvelope } from "@/lib/torgima-api";

export type GoalUnderstanding = {
  object: string;
  domain: string;
  impliedUser: string;
  impliedOutcome: string;
  unclear: string[];
};

export type PurposeUnderstanding = {
  problem: string;
  targetUser: string;
  change: string;
  value: string;
};

export async function understandGoal(rawGoal: string) {
  return apiFetchEnvelope<{ options: string[] }>("/api/v1/erector/refinement/goal/understand", {
    method: "POST",
    body: JSON.stringify({ rawGoal }),
  });
}

export async function selectGoalOption(blueprintId: string, optionIndex: number) {
  return apiFetchEnvelope<{ selectedGoalOption: number; preview: string }>(
    "/api/v1/erector/refinement/goal/select",
    { method: "POST", body: JSON.stringify({ blueprintId, optionIndex }) },
  );
}

export async function finalizeGoal(blueprintId: string, goalFinal: string) {
  return apiFetchEnvelope<{ goal_final: string }>("/api/v1/erector/refinement/goal/finalize", {
    method: "POST",
    body: JSON.stringify({ blueprintId, goalFinal }),
  });
}

export async function understandPurpose(rawPurpose: string, selectedGoal: string) {
  return apiFetchEnvelope<{ options: string[] }>("/api/v1/erector/refinement/purpose/understand", {
    method: "POST",
    body: JSON.stringify({ rawPurpose, selectedGoal }),
  });
}

export async function selectPurposeOption(blueprintId: string, optionIndex: number) {
  return apiFetchEnvelope<{ selectedPurposeOption: number; preview: string }>(
    "/api/v1/erector/refinement/purpose/select",
    { method: "POST", body: JSON.stringify({ blueprintId, optionIndex }) },
  );
}

export async function finalizePurpose(blueprintId: string, purposeFinal: string) {
  return apiFetchEnvelope<{ purpose_final: string }>("/api/v1/erector/refinement/purpose/finalize", {
    method: "POST",
    body: JSON.stringify({ blueprintId, purposeFinal }),
  });
}

export async function lockRefinement(blueprintId: string) {
  return apiFetchEnvelope<{ locked: boolean }>("/api/v1/erector/refinement/lock", {
    method: "POST",
    body: JSON.stringify({ blueprintId }),
  });
}

export async function saveValidationFeed(
  blueprintId: string,
  feed: Record<string, unknown>,
) {
  return apiFetchEnvelope<{ validationId: string; economicType: string }>(
    "/api/v1/erector/refinement/feed",
    { method: "POST", body: JSON.stringify({ blueprintId, ...feed }) },
  );
}

export async function fetchRefinementState(blueprintId: string) {
  return apiFetchEnvelope<{
    refinement: {
      raw_goal?: string;
      goal_options?: string[];
      goal_final?: string;
      raw_purpose?: string;
      purpose_options?: string[];
      purpose_final?: string;
      refinement_locked?: boolean;
    } | null;
    validationId?: string;
  }>(`/api/v1/erector/refinement/${blueprintId}`);
}
