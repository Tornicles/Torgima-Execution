import { LANGUAGE } from "@/lib/language";

const PROJECT_NAME_PATTERN = /^[\p{L}\p{N}\s\-'&]+$/u;

export function validateProjectNameInput(name: string): string | null {
  const t = name.trim();
  if (t.length < 3) return LANGUAGE.errors.projectNameRequired;
  if (t.length > 50) return LANGUAGE.errors.projectNameTooLong;
  if (!PROJECT_NAME_PATTERN.test(t)) return LANGUAGE.errors.projectNameInvalid;
  return null;
}

export function defaultProjectName(domain?: string): string {
  const d = (domain ?? "Business").trim() || "Business";
  return `My ${d} Project`.slice(0, 50);
}
