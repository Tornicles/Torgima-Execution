export type ValidationPathType = "current" | "adjusted" | "alternative";

/** Normalize legacy path fields on a validation row. */
export function normalizeSelectedPath(
  row: {
    selected_path_type?: string | null;
    selected_path?: string | null;
    selected_direction?: string | null;
    verdict?: string | null;
  },
  launchOverride?: ValidationPathType,
): ValidationPathType | null {
  const raw =
    launchOverride ??
    (row.selected_path_type as ValidationPathType | undefined) ??
    (row.selected_path as ValidationPathType | undefined) ??
    (row.selected_direction as ValidationPathType | undefined);
  if (raw === "current" || raw === "adjusted" || raw === "alternative") return raw;
  return null;
}

/** Default path after validation completes (before user override). */
export function resolveDefaultSelectedPath(verdict?: string | null): ValidationPathType {
  if (verdict === "pivot") return "alternative";
  if (verdict === "adjust") return "adjusted";
  return "current";
}
