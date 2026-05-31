const PROJECT_NAME_PATTERN = /^[\p{L}\p{N}\s\-'&]+$/u;

export function defaultProjectName(domain?: string): string {
  const d = (domain ?? "Business").trim() || "Business";
  return `My ${d} Project`.slice(0, 50);
}

export function normalizeProjectName(value: unknown, fallbackDomain?: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length >= 3 && trimmed.length <= 50 && PROJECT_NAME_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return defaultProjectName(fallbackDomain);
}

export function validateProjectNameStrict(value: unknown): string | null {
  if (typeof value !== "string") return "Project name is required.";
  const t = value.trim();
  if (t.length < 3) return "Enter at least 3 characters for your project name.";
  if (t.length > 50) return "Project name must be 50 characters or fewer.";
  if (!PROJECT_NAME_PATTERN.test(t)) {
    return "Use letters, numbers, spaces, hyphens, apostrophes, or & only.";
  }
  return null;
}
