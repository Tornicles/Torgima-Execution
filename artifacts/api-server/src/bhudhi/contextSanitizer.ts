const SECRET_KEY_PATTERN =
  /password|secret|api[_-]?key|token|credential|private[_-]?note|authorization/i;

const SECRET_VALUE_PATTERN =
  /(?:sk-[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9._-]+|AKIA[0-9A-Z]{16})/i;

export function stripSecretsFromValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (SECRET_VALUE_PATTERN.test(value)) return "[REDACTED]";
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stripSecretsFromValue);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = stripSecretsFromValue(val);
      }
    }
    return out;
  }
  return value;
}

export function stripSecretsFromRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return stripSecretsFromValue(record) as Record<string, unknown>;
}
