/** Safe Postgres error logging for schema mismatch diagnosis (no user content). */
export function logSchemaDbError(
  operation: string,
  table: string,
  err: unknown,
  meta?: Record<string, unknown>,
): void {
  const parts: { code?: string; message: string }[] = [];
  const visit = (e: unknown): void => {
    if (!e || typeof e !== "object") return;
    const o = e as Record<string, unknown>;
    if (typeof o.code === "string" || typeof o.code === "number") {
      parts.push({
        code: String(o.code),
        message: typeof o.message === "string" ? o.message : "",
      });
    } else if (typeof o.message === "string") {
      parts.push({ message: o.message });
    }
    if ("cause" in o && o.cause != null) visit(o.cause);
  };
  visit(err);

  const message = parts
    .map((p) => p.message)
    .filter(Boolean)
    .join(" ");
  const pgCode = parts.find((p) => p.code && /^[0-9A-Z]{5}$/.test(p.code))?.code;
  const missingColumn = message.match(/column "([^"]+)"/i)?.[1];
  const missingRelation = message.match(/relation "([^"]+)"/i)?.[1];

  console.error("[DB schema]", {
    operation,
    table,
    pgCode: pgCode ?? null,
    message: message.slice(0, 500),
    missingColumn: missingColumn ?? null,
    missingRelation: missingRelation ?? null,
    ...meta,
  });
}
