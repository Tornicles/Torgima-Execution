import {
  db,
  bhudhiIdentityProfiles,
  bhudhiIdentityValues,
  bhudhiIdentityGrowth,
  bhudhiIdentityHistory,
  bhudhiIdentityEvents,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { IdentityOutput, RankedValue } from "./contracts/types.js";

export async function persistIdentitySession(
  output: IdentityOutput,
  input: { blueprintId: string; userId?: string },
): Promise<string> {
  const profileId = output.identityState.profileId;

  await db.insert(bhudhiIdentityProfiles).values({
    id: profileId,
    blueprint_id: input.blueprintId,
    user_id: input.userId ?? null,
    execution_profile: output.identityState.executionProfile,
    personality: output.personality,
    capabilities: output.capabilities,
    motivations: output.motivations,
    identity_state: output.identityState,
    growth_direction: output.growthDirection.nextIdentity,
    confidence: output.capabilities.capabilityScore,
  });

  for (const v of output.values.rankedValues) {
    await db.insert(bhudhiIdentityValues).values({
      profile_id: profileId,
      value_key: v.key,
      rank: v.rank,
      protected: v.protected,
      temporary: v.temporary,
      weight: v.weight,
    });
  }

  await db.insert(bhudhiIdentityGrowth).values({
    profile_id: profileId,
    current_state: output.growthDirection.currentState,
    next_identity: output.growthDirection.nextIdentity,
    maturity: output.growthDirection.maturity,
    stability: output.growthDirection.stability,
    recommended_transitions: output.growthDirection.recommendedTransitions,
  });

  await db.insert(bhudhiIdentityHistory).values({
    profile_id: profileId,
    change_type: "observe",
    new_snapshot: output as unknown as Record<string, unknown>,
    reason: "Identity session formed",
  });

  if (output.drift?.detected) {
    await db.insert(bhudhiIdentityEvents).values({
      blueprint_id: input.blueprintId,
      profile_id: profileId,
      event_type: "drift",
      description: output.drift.signals.join(", "),
      action: output.drift.action,
    });
  }

  return profileId;
}

export async function listIdentityHistory(blueprintId: string, limit = 20) {
  const profiles = await db
    .select()
    .from(bhudhiIdentityProfiles)
    .where(eq(bhudhiIdentityProfiles.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiIdentityProfiles.updated_at))
    .limit(limit);

  return profiles.map((p) => ({
    profileId: p.id,
    executionProfile: p.execution_profile,
    growthDirection: p.growth_direction,
    confidence: p.confidence,
    updatedAt: p.updated_at,
  }));
}

export async function getIdentityProfile(profileId: string) {
  const rows = await db
    .select()
    .from(bhudhiIdentityProfiles)
    .where(eq(bhudhiIdentityProfiles.id, profileId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listIdentityValues(profileId: string): Promise<RankedValue[]> {
  const rows = await db
    .select()
    .from(bhudhiIdentityValues)
    .where(eq(bhudhiIdentityValues.profile_id, profileId))
    .orderBy(bhudhiIdentityValues.rank);

  return rows.map((r) => ({
    key: r.value_key,
    rank: r.rank,
    weight: r.weight,
    protected: r.protected,
    temporary: r.temporary,
  }));
}
