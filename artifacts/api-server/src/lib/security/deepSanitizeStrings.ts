const HTML_TAG = /<[^>]*>/g;
const SCRIPT_PATTERN = /<script|javascript:|on\w+\s*=/i;

export function deepSanitizeStrings<T>(obj: T): T {
  if (typeof obj === "string") {
    let s = obj.replace(HTML_TAG, "");
    if (SCRIPT_PATTERN.test(s)) s = s.replace(SCRIPT_PATTERN, "");
    return s.trim() as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => deepSanitizeStrings(v)) as T;
  }
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, deepSanitizeStrings(v)]),
    ) as T;
  }
  return obj;
}
