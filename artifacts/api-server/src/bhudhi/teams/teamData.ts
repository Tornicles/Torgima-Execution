import {
  db,
  bhudhiTeams,
  bhudhiTeamIdentity,
  bhudhiTeamMemory,
  bhudhiTeamAlignment,
  bhudhiTeamHealth,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { TeamOutput, AlignmentResult, TeamIdentityResult, TeamHealthResult } from "./contracts/types.js";

export async function persistTeam(output: TeamOutput, blueprintId: string, name: string): Promise<void> {
  await db.insert(bhudhiTeams).values({
    id: output.teamId,
    blueprint_id: blueprintId,
    name,
    team_state: output.teamState,
    alignment: output.alignment,
    capacity: output.capacity,
    recommendation: output.recommendation,
  });

  if (output.teamIdentity) {
    const ti = output.teamIdentity;
    await db.insert(bhudhiTeamIdentity).values({
      team_id: output.teamId,
      mission: (ti.identity.mission as string) ?? null,
      values: (ti.identity.values as string[]) ?? [],
      strengths: (ti.identity.strengths as string[]) ?? [],
      blindspots: (ti.identity.blindspots as string[]) ?? [],
      working_style: (ti.identity.workingStyle as string) ?? null,
      health: ti.health,
      drift: ti.drift,
    });
  }

  if (output.consensus) {
    await db.insert(bhudhiTeamMemory).values({
      team_id: output.teamId,
      memory_type: "decision",
      content: output.consensus,
    });
  }

  const align: AlignmentResult = {
    alignment: output.alignment,
    conflicts: [],
    recommendations: [output.recommendation],
  };
  await db.insert(bhudhiTeamAlignment).values({
    team_id: output.teamId,
    goal_alignment: output.alignment,
    strategy_alignment: output.alignment,
    identity_alignment: output.teamIdentity?.health ?? 0.5,
    conflicts: align.conflicts,
    recommendations: align.recommendations,
  });

  if (output.health) {
    const h = output.health;
    await db.insert(bhudhiTeamHealth).values({
      team_id: output.teamId,
      score: h.score,
      burnout: h.burnout,
      load: h.load,
      trust: h.trust,
      momentum: h.momentum,
      engagement: h.engagement,
      action: h.action,
    });
  }
}

export async function listTeamHistory(blueprintId: string, limit = 20) {
  const rows = await db
    .select()
    .from(bhudhiTeams)
    .where(eq(bhudhiTeams.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiTeams.updated_at))
    .limit(limit);

  return rows.map((r) => ({
    teamId: r.id,
    name: r.name,
    alignment: r.alignment,
    recommendation: r.recommendation,
    updatedAt: r.updated_at,
  }));
}

export async function getTeam(teamId: string) {
  const rows = await db.select().from(bhudhiTeams).where(eq(bhudhiTeams.id, teamId)).limit(1);
  return rows[0] ?? null;
}
