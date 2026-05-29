import { z } from "zod/v4";
import {
  generateGoalOptionsDeterministic,
  generatePurposeOptionsDeterministic,
  understandGoalDeterministic,
  understandPurposeDeterministic,
} from "../engines/erector/ErectorRefinementEngine.js";

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_root";
    out[key] = [...(out[key] ?? []), issue.message];
  }
  return out;
}

const goalUnderstandSchema = z
  .object({
    rawGoal: z.string(),
    blueprintId: z.string().uuid().optional(),
  })
  .strict();

const purposeUnderstandSchema = z
  .object({
    rawPurpose: z.string(),
    selectedGoal: z.string(),
    blueprintId: z.string().uuid().optional(),
  })
  .strict();

export function parseGoalUnderstandBody(body: unknown):
  | { ok: true; rawGoal: string }
  | { ok: false; fieldErrors: Record<string, string[]> } {
  const parsed = goalUnderstandSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  }
  const rawGoal = parsed.data.rawGoal.trim();
  if (!rawGoal) {
    return { ok: false, fieldErrors: { rawGoal: ["rawGoal is required"] } };
  }
  return { ok: true, rawGoal };
}

export function parsePurposeUnderstandBody(body: unknown):
  | { ok: true; rawPurpose: string; selectedGoal: string }
  | { ok: false; fieldErrors: Record<string, string[]> } {
  const parsed = purposeUnderstandSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  }
  const rawPurpose = parsed.data.rawPurpose.trim();
  const selectedGoal = parsed.data.selectedGoal.trim();
  const fieldErrors: Record<string, string[]> = {};
  if (!rawPurpose) fieldErrors.rawPurpose = ["rawPurpose is required"];
  if (!selectedGoal) fieldErrors.selectedGoal = ["selectedGoal is required"];
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  return { ok: true, rawPurpose, selectedGoal };
}

export function buildRefinementFallbackOptions(rawInput: string): string[] {
  const base = rawInput.trim().slice(0, 200) || "your direction";
  return [
    `${base} — focused execution path`,
    `${base} — structured growth path`,
    `${base} — validated market path`,
  ];
}

export function refineGoalOptions(rawGoal: string): string[] {
  const understanding = understandGoalDeterministic(rawGoal);
  return generateGoalOptionsDeterministic(rawGoal, understanding);
}

export function refinePurposeOptions(rawPurpose: string, selectedGoal: string): string[] {
  const understanding = understandPurposeDeterministic(rawPurpose, selectedGoal);
  return generatePurposeOptionsDeterministic(rawPurpose, understanding);
}

/** Never fail refinement — deterministic engine first, then safe fallback options. */
export function safeRefineGoalOptions(rawGoal: string): string[] {
  try {
    const options = refineGoalOptions(rawGoal);
    if (options.length >= 3) return options.slice(0, 3);
  } catch (err) {
    console.error("[Refinement] Bhudhi unavailable, using fallback", err);
  }
  return buildRefinementFallbackOptions(rawGoal);
}

export function safeRefinePurposeOptions(rawPurpose: string, selectedGoal: string): string[] {
  try {
    const options = refinePurposeOptions(rawPurpose, selectedGoal);
    if (options.length >= 3) return options.slice(0, 3);
  } catch (err) {
    console.error("[Refinement] Bhudhi unavailable, using fallback", err);
  }
  return buildRefinementFallbackOptions(rawPurpose);
}
