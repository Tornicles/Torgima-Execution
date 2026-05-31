export function pickAllowed<T extends Record<string, unknown>>(
  body: Record<string, unknown> | null | undefined,
  allowedFields: readonly string[],
): Partial<T> {
  const src = body ?? {};
  const acc: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (src[field] !== undefined) acc[field] = src[field];
  }
  return acc as Partial<T>;
}

export const ALLOWED_ONBOARDING_FIELDS = [
  "goal",
  "purpose",
  "projectName",
  "location",
  "domain",
  "commitmentLevel",
  "timeframeStart",
  "timeframeEnd",
  "currentContext",
  "budget",
  "rawGoal",
  "rawPurpose",
  "timeframe",
  "selectedBlueprintTier",
  "selectedBlueprintMode",
] as const;
