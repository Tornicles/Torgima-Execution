const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUID(id: string | undefined | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_RE.test(id.trim());
}

export function requireValidUUID(id: string | undefined | null, label = "id"): string {
  const trimmed = typeof id === "string" ? id.trim() : "";
  if (!validateUUID(trimmed)) {
    throw new Error(`Invalid ${label} format`);
  }
  return trimmed;
}
