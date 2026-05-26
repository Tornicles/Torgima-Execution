import type { Request, Response } from "express";
import { db, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { failure } from "../../lib/utils.js";

export async function requireUserBlueprint(
  res: Response,
  blueprintId: string,
  userId: string,
): Promise<boolean> {
  const [bp] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);

  if (!bp) {
    failure(res, "NOT_FOUND", "Blueprint not found", 404);
    return false;
  }
  return true;
}

export function blueprintIdFromQuery(req: Request): string | undefined {
  const q = req.query.blueprintId;
  return typeof q === "string" ? q : undefined;
}
