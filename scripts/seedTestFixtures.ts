/**
 * GAP G9 / DOC_36 — seed minimal acceptance fixtures on a fresh test database.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... TORGIMA_INTEGRATION=true pnpm exec tsx scripts/seedTestFixtures.ts
 */
import "dotenv/config";
import { db, users, blueprints, capabilityProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";

const FIXTURE_EMAIL = "gap-g9-acceptance@torgima-test.local";

export async function seedGapG9Fixture(): Promise<{ userId: string; blueprintId: string }> {
  const existing = await db.select().from(users).where(eq(users.email, FIXTURE_EMAIL)).limit(1);
  if (existing[0]) {
    const [bp] = await db
      .select()
      .from(blueprints)
      .where(eq(blueprints.user_id, existing[0].id))
      .limit(1);
    return { userId: existing[0].id, blueprintId: bp?.id ?? "" };
  }

  const [user] = await db
    .insert(users)
    .values({
      email: FIXTURE_EMAIL,
      display_name: "GAP G9 Acceptance",
      tier: "growth",
      mode: "individual",
      commitment_level: "medium",
    })
    .returning();

  if (!user) throw new Error("seedGapG9Fixture: user insert failed");

  await db.insert(capabilityProfiles).values({ user_id: user.id });

  const [bp] = await db
    .insert(blueprints)
    .values({
      user_id: user.id,
      goal: "GAP G9 acceptance: ship Phase 1 individual system",
      raw_goal: "GAP G9 acceptance: ship Phase 1 individual system",
      purpose: "Verify full execution loop",
      timeframe_days: 90,
      commitment_level: "medium",
      tier: "starter",
      mode: "individual",
      status: "active",
      active: true,
      state_version: 1,
      current_domain: "delivery",
      current_condition: "urgency",
    })
    .returning();

  if (!bp) throw new Error("seedGapG9Fixture: blueprint insert failed");

  await db.update(capabilityProfiles).set({ blueprint_id: bp.id }).where(eq(capabilityProfiles.user_id, user.id));

  return { userId: user.id, blueprintId: bp.id };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[seedTestFixtures] DATABASE_URL is required");
    process.exit(1);
  }
  const fx = await seedGapG9Fixture();
  console.log("[seedTestFixtures] OK", fx);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
