import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  db,
  erectorCapabilityGraph,
  erectorCapabilityProfiles,
} from "@workspace/db";
import type {
  BlockLevel,
  CapabilityGapDetectionResult,
  CapabilityGapItem,
  ProofLevel,
} from "./types.js";

const PROOF_LEVEL_RANK: Record<ProofLevel, number> = {
  none: 0,
  attempted: 1,
  partial: 2,
  proven: 3,
};

export const ACTION_TYPE_CAPABILITY_MAP: Record<string, string[]> = {
  copywriting: ["CAP-copywriting-01"],
  write: ["CAP-copywriting-01"],
  sales: ["CAP-sales-conversation-01"],
  discovery: ["CAP-customer-discovery-01"],
  mvp: ["CAP-product-mvp-01"],
  retention: ["CAP-retention-01"],
  distribution: ["CAP-content-distribution-01"],
};

function normalizeProofLevel(value: string | null | undefined): ProofLevel {
  const normalized = (value ?? "none").toLowerCase();
  if (normalized === "proven") return "proven";
  if (normalized === "partial") return "partial";
  if (normalized === "attempted") return "attempted";
  return "none";
}

function tierColumn(tier: string): "available_starter" | "available_growth" | "available_ultimate" {
  if (tier === "ultimate") return "available_ultimate";
  if (tier === "growth" || tier === "pro") return "available_growth";
  return "available_starter";
}

function capabilityMatchesActionType(
  capability: typeof erectorCapabilityGraph.$inferSelect,
  nextActionType: string,
): boolean {
  const normalized = nextActionType.toLowerCase();
  if (
    capability.required_for_task_types.some(
      (taskType) => taskType.toLowerCase() === normalized,
    )
  ) {
    return true;
  }

  const mappedIds = ACTION_TYPE_CAPABILITY_MAP[normalized] ?? [];
  if (mappedIds.includes(capability.capability_id)) return true;

  return capability.capability_id.toLowerCase().includes(normalized.replace(/_/g, "-"));
}

export async function detectCapabilityGaps(input: {
  userId: string;
  blueprintId: string;
  nextActionType: string;
  domain: string;
  phase: string;
  tier: string;
}): Promise<CapabilityGapDetectionResult> {
  const tierKey = tierColumn(input.tier);
  const mappedCapabilityIds = ACTION_TYPE_CAPABILITY_MAP[input.nextActionType.toLowerCase()] ?? [];

  const capabilities = await db
    .select()
    .from(erectorCapabilityGraph)
    .where(
      and(
        eq(erectorCapabilityGraph.active, true),
        eq(erectorCapabilityGraph.domain, input.domain),
        eq(erectorCapabilityGraph[tierKey], true),
        or(
          sql`${erectorCapabilityGraph.required_for_task_types} @> ARRAY[${input.nextActionType}]::text[]`,
          mappedCapabilityIds.length > 0
            ? inArray(erectorCapabilityGraph.capability_id, mappedCapabilityIds)
            : sql`false`,
        ),
      ),
    );

  const actionCapabilities = capabilities.filter((capability) =>
    capabilityMatchesActionType(capability, input.nextActionType),
  );

  if (actionCapabilities.length === 0) {
    return { gap_detected: false, gaps: [], should_block_task_generation: false };
  }

  const capabilityIds = actionCapabilities.map((capability) => capability.capability_id);
  const profiles = capabilityIds.length
    ? await db
        .select()
        .from(erectorCapabilityProfiles)
        .where(
          and(
            eq(erectorCapabilityProfiles.user_id, input.userId),
            inArray(erectorCapabilityProfiles.capability_id, capabilityIds),
          ),
        )
    : [];

  const profileByCapability = new Map(
    profiles.map((profile) => [profile.capability_id, profile]),
  );

  const gaps: CapabilityGapItem[] = [];

  for (const capability of actionCapabilities) {
    for (const prerequisiteId of capability.prerequisite_capabilities) {
      const prerequisite = actionCapabilities.find(
        (row) => row.capability_id === prerequisiteId,
      );
      if (!prerequisite) continue;

      const prerequisiteProfile = profileByCapability.get(prerequisiteId);
      const prerequisiteLevel = normalizeProofLevel(prerequisiteProfile?.proof_level);
      if (PROOF_LEVEL_RANK[prerequisiteLevel] < PROOF_LEVEL_RANK.proven) {
        gaps.push(buildGapItem(prerequisite, prerequisiteProfile, true));
        continue;
      }
    }

    const profile = profileByCapability.get(capability.capability_id);
    const currentLevel = normalizeProofLevel(profile?.proof_level);
    const decayed = profile?.decay_status === "decayed";
    const requiredLevel: ProofLevel = "proven";

    if (decayed || PROOF_LEVEL_RANK[currentLevel] < PROOF_LEVEL_RANK[requiredLevel]) {
      gaps.push(buildGapItem(capability, profile, false));
    }
  }

  const uniqueGaps = dedupeGaps(gaps);

  return {
    gap_detected: uniqueGaps.length > 0,
    gaps: uniqueGaps,
    should_block_task_generation: uniqueGaps.some((gap) => gap.block_level === "hard"),
  };
}

function buildGapItem(
  capability: typeof erectorCapabilityGraph.$inferSelect,
  profile: typeof erectorCapabilityProfiles.$inferSelect | undefined,
  isPrerequisite: boolean,
): CapabilityGapItem {
  const currentLevel = normalizeProofLevel(profile?.proof_level);
  const hasProxyEvidence =
    (profile?.proof_count ?? 0) > 0 || (profile?.capability_signal ?? 0) >= 40;
  const blockLevel: BlockLevel =
    isPrerequisite || !hasProxyEvidence ? "hard" : "soft";

  return {
    capability_id: capability.capability_id,
    capability_name: capability.capability_name,
    required_proof_level: "proven",
    current_proof_level: profile?.decay_status === "decayed" ? "none" : currentLevel,
    block_level: blockLevel,
    blocks_execution: blockLevel === "hard",
    academy_task_needed: true,
    missing_evidence: [capability.proof_required],
  };
}

function dedupeGaps(gaps: CapabilityGapItem[]): CapabilityGapItem[] {
  const seen = new Set<string>();
  return gaps.filter((gap) => {
    if (seen.has(gap.capability_id)) return false;
    seen.add(gap.capability_id);
    return true;
  });
}

export function proofLevelMeetsRequired(
  current: ProofLevel,
  required: ProofLevel,
): boolean {
  return PROOF_LEVEL_RANK[current] >= PROOF_LEVEL_RANK[required];
}
