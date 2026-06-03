/**
 * DOC 36 — reset dedicated test user before full-loop runs.
 */
import { db, users, capabilityProfiles, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { DOC36_TEST_EMAIL } from "./doc36-constants.js";
import { resetUserExecutionState } from "./executionStateReset.js";

export { DOC36_TEST_EMAIL };

export async function findOrCreateDoc36User(): Promise<{ id: string; email: string }> {
  const [existing] = await db.select().from(users).where(eq(users.email, DOC36_TEST_EMAIL)).limit(1);
  if (existing) return { id: existing.id, email: existing.email };

  const [created] = await db
    .insert(users)
    .values({
      email: DOC36_TEST_EMAIL,
      display_name: "DOC36 Loop Test",
      tier: "starter",
      mode: "individual",
      commitment_level: "medium",
      onboarding_complete: false,
    })
    .returning({ id: users.id, email: users.email });
  if (!created) throw new Error("DOC36: failed to create test user");
  await db.insert(capabilityProfiles).values({ user_id: created.id });
  return created;
}

export async function resetDoc36TestUser(email = DOC36_TEST_EMAIL): Promise<{ userId: string }> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    const created = await findOrCreateDoc36User();
    return { userId: created.id };
  }

  await resetUserExecutionState(user.id);
  return { userId: user.id };
}

export async function doc36HasActiveBlueprint(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  return Boolean(row?.id);
}
