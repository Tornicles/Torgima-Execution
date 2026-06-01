import { db, blueprintHealthRecords, blueprintInterpretations, orders } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { routeBhudhiRequest } from "../TriggerRouter.js";
import { validateOutputLayers } from "../OutputValidatorLayers.js";
import { getBlueprintStructure } from "../../engines/blueprint/BlueprintStructureService.js";
import { submitProposal } from "../../engines/governance/GovernanceService.js";
import { getWorldModel, validateWorldStateVersion } from "../../engines/world-model/WorldModelEngine.js";
import { TorgimaError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

export type BlueprintAnalysisTrigger =
  | "CREATION"
  | "PHASE_TRANSITION"
  | "HEALTH_CHECK"
  | "SIGNAL_SHIFT"
  | "OVERNIGHT";

export interface BlueprintAnalysisInput {
  blueprintId: string;
  userId: string;
  worldStateVersion: number;
  triggerReason: BlueprintAnalysisTrigger;
}

export interface BlueprintGap {
  gapType:
    | "MISSING_PHASE"
    | "DEAD_ACTION"
    | "STAGNANT_PHASE"
    | "WEAK_TARGET"
    | "MISSING_PROJECT"
    | "ORPHANED_ORDER";
  location: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  evidence: string;
}

export interface GovernanceProposal {
  proposalType: string;
  proposalContent: Record<string, unknown>;
  rationale: string;
  evidenceCitations: string[];
  impactAssessment: Record<string, unknown>;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
}

export interface BlueprintAnalysisOutput {
  healthScore: number;
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  gapsDetected: BlueprintGap[];
  proposalsGenerated: GovernanceProposal[];
  phaseReadiness: Record<string, boolean>;
  agentAssessment: string;
  worldStateVersion: number;
}

export interface BlueprintInterpretationResult {
  interpretation: string;
  keyInsights: string[];
  currentFocus: string;
  nextMilestone: string;
  riskFlags: string[];
  confidenceTier: string;
  generatedAt: Date;
  expiresAt: Date;
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function detectStructuralGaps(structure: Awaited<ReturnType<typeof getBlueprintStructure>>): BlueprintGap[] {
  const gaps: BlueprintGap[] = [];
  if (structure.plans.length === 0) {
    gaps.push({
      gapType: "MISSING_PHASE",
      location: "Blueprint root",
      description: "No plans exist yet for this blueprint.",
      severity: "HIGH",
      evidence: "Empty plan list in structure fetch",
    });
  }

  for (const plan of structure.plans) {
    for (const phase of plan.phases) {
      if (phase.projects.length === 0) {
        gaps.push({
          gapType: "MISSING_PROJECT",
          location: `Phase ${phase.name}`,
          description: "Phase has no projects attached.",
          severity: "MEDIUM",
          evidence: `Phase ${phase.id} project count = 0`,
        });
      }
      for (const project of phase.projects) {
        for (const action of project.actions) {
          const recentOrders = action.orders.filter(
            o => o.status === "active" || o.status === "completed",
          );
          if (recentOrders.length === 0 && action.status !== "completed") {
            gaps.push({
              gapType: "DEAD_ACTION",
              location: `Action ${action.name}`,
              description: "Action has no active or completed orders in 7+ days window.",
              severity: "MEDIUM",
              evidence: `Action ${action.id} order count = 0`,
            });
          }
        }
      }
      if (phase.status === "active" && !phase.completed_at) {
        const started = phase.started_at?.getTime() ?? Date.now();
        if (Date.now() - started > FOURTEEN_DAYS_MS) {
          gaps.push({
            gapType: "STAGNANT_PHASE",
            location: `Phase ${phase.name}`,
            description: "Phase has been active for 14+ days without completion.",
            severity: "HIGH",
            evidence: `Phase ${phase.id} started_at stale`,
          });
        }
      }
    }
  }

  return gaps;
}

function gapsToProposals(gaps: BlueprintGap[]): GovernanceProposal[] {
  return gaps.slice(0, 5).map(gap => ({
    proposalType:
      gap.gapType === "MISSING_PROJECT" ? "ADD_PROJECT"
      : gap.gapType === "MISSING_PHASE" ? "ADD_PHASE"
      : "RESEQUENCE",
    proposalContent: {
      gapType: gap.gapType,
      location: gap.location,
      title: `Address: ${gap.gapType}`,
    },
    rationale: gap.description,
    evidenceCitations: [gap.evidence],
    impactAssessment: { severity: gap.severity },
    priority: gap.severity === "CRITICAL" || gap.severity === "HIGH" ? "HIGH" : "NORMAL",
  }));
}

export async function analyzeBlueprint(input: BlueprintAnalysisInput): Promise<BlueprintAnalysisOutput> {
  const versionOk = await validateWorldStateVersion(input.userId, input.worldStateVersion);
  if (!versionOk) {
    throw new TorgimaError("STALE_STATE", "World state version mismatch — analysis rejected");
  }

  const structure = await getBlueprintStructure(input.blueprintId);
  const gaps = detectStructuralGaps(structure);
  const proposals = gapsToProposals(gaps);

  const confidenceTier: "HIGH" | "MEDIUM" | "LOW" = gaps.length === 0 ? "HIGH" : "MEDIUM";
  let resolvedConfidence: "HIGH" | "MEDIUM" | "LOW" = confidenceTier;
  let agentAssessment = `Blueprint health scan (${input.triggerReason}): ${gaps.length} gap(s) detected.`;

  const bhudhi = await routeBhudhiRequest({
    sourceEngine: "BlueprintAgent",
    triggerType: "BLUEPRINT_GENERATION",
    userId: input.userId,
    blueprintId: input.blueprintId,
    stateVersion: input.worldStateVersion,
    facts: {
      gapCount: gaps.length,
      goal: structure.blueprint.goal,
      triggerReason: input.triggerReason,
    },
    idempotencyKey: `blueprint.health:${input.blueprintId}:${input.triggerReason}:${Date.now()}`,
  }).catch(() => null);

  if (bhudhi?.output) {
    const validation = await validateOutputLayers({
      raw: bhudhi.output,
      expectedType: "blueprint_health",
      expectedStateVersion: input.worldStateVersion,
      userId: input.userId,
      promptContract: "blueprint.health_analysis.v1",
    });
    if (validation.passed) {
      const data = bhudhi.output.data as Record<string, unknown>;
      if (typeof data["agentAssessment"] === "string") {
        agentAssessment = String(data["agentAssessment"]).slice(0, 500);
      }
      resolvedConfidence = validation.confidenceTier;
    }
  }

  const phaseReadiness: Record<string, boolean> = {};
  for (const plan of structure.plans) {
    for (const phase of plan.phases) {
      phaseReadiness[phase.id] = phase.status === "complete" || phase.gate_passed === true;
    }
  }

  const deadActions = gaps.filter(g => g.gapType === "DEAD_ACTION").length;
  const stagnantPhases = gaps.filter(g => g.gapType === "STAGNANT_PHASE").length;
  const healthScore = Math.max(0, Math.min(1, 1 - gaps.length * 0.08));

  for (const proposal of proposals) {
    await submitProposal({
      proposal,
      blueprintId: input.blueprintId,
      userId: input.userId,
      worldStateVersion: input.worldStateVersion,
    });
  }

  await db.insert(blueprintHealthRecords).values({
    blueprint_id: input.blueprintId,
    health_score: healthScore,
    phase_progress_rate: Object.values(phaseReadiness).filter(Boolean).length / Math.max(1, Object.keys(phaseReadiness).length),
    gaps_detected: gaps,
    dead_actions_count: deadActions,
    stagnant_phases_count: stagnantPhases,
    proposals_generated: proposals.length,
    agent_assessment: agentAssessment,
    confidence_tier: resolvedConfidence,
    world_state_version: input.worldStateVersion,
  });

  logger.info(
    { blueprintId: input.blueprintId, gaps: gaps.length, proposals: proposals.length },
    "[BlueprintAgent] analyzeBlueprint complete",
  );

  return {
    healthScore,
    confidenceTier: resolvedConfidence,
    gapsDetected: gaps,
    proposalsGenerated: proposals,
    phaseReadiness,
    agentAssessment,
    worldStateVersion: input.worldStateVersion,
  };
}

export async function generateInterpretation(
  blueprintId: string,
  userId: string,
  options?: { forceRefresh?: boolean },
): Promise<BlueprintInterpretationResult> {
  const [cached] = await db
    .select()
    .from(blueprintInterpretations)
    .where(eq(blueprintInterpretations.blueprint_id, blueprintId))
    .limit(1);

  const world = await getWorldModel(userId);
  const stateVersion = world?.stateVersion ?? 0;

  if (
    cached &&
    !options?.forceRefresh &&
    cached.expires_at > new Date() &&
    cached.world_state_version === stateVersion
  ) {
    return {
      interpretation: cached.interpretation,
      keyInsights: (cached.key_insights as string[]) ?? [],
      currentFocus: cached.current_focus,
      nextMilestone: cached.next_milestone,
      riskFlags: (cached.risk_flags as string[]) ?? [],
      confidenceTier: cached.confidence_tier,
      generatedAt: cached.generated_at,
      expiresAt: cached.expires_at,
    };
  }

  const structure = await getBlueprintStructure(blueprintId);
  const result = await routeBhudhiRequest({
    sourceEngine: "BlueprintAgent",
    triggerType: "BLUEPRINT_INTERPRETATION",
    userId,
    blueprintId,
    stateVersion,
    facts: {
      goal: structure.blueprint.goal,
      purpose: structure.blueprint.purpose,
      condition: structure.blueprint.current_condition,
      planCount: structure.plans.length,
    },
    idempotencyKey: `blueprint.interpret:${blueprintId}:${stateVersion}`,
  });

  type InterpretPayload = {
    interpretation: string;
    keyInsights: string[];
    currentFocus: string;
    nextMilestone: string;
    riskFlags: string[];
    confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  };

  const fallback: InterpretPayload = {
    interpretation: `You are executing toward: ${structure.blueprint.goal.slice(0, 400)}`,
    keyInsights: ["Stay focused on the active phase", "Submit feedback after each order"],
    currentFocus: "Complete your current active order",
    nextMilestone: "Finish the active phase gate requirements",
    riskFlags: [],
    confidenceTier: "MEDIUM",
  };

  let payload: InterpretPayload = fallback;
  if (result.output) {
    const validation = await validateOutputLayers({
      raw: result.output,
      expectedType: "blueprint_interpretation",
      expectedStateVersion: stateVersion,
      userId,
      promptContract: "blueprint.interpret.v1",
    });
    if (validation.passed) {
      const d = result.output.data as Record<string, unknown>;
      payload = {
        interpretation: String(d["interpretation"] ?? fallback.interpretation).slice(0, 800),
        keyInsights: Array.isArray(d["keyInsights"]) ? (d["keyInsights"] as string[]).slice(0, 3) : fallback.keyInsights,
        currentFocus: String(d["currentFocus"] ?? fallback.currentFocus).slice(0, 200),
        nextMilestone: String(d["nextMilestone"] ?? fallback.nextMilestone).slice(0, 200),
        riskFlags: Array.isArray(d["riskFlags"]) ? (d["riskFlags"] as string[]) : [],
        confidenceTier: validation.confidenceTier,
      };
    }
  }

  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + 24 * 60 * 60 * 1000);

  await db
    .insert(blueprintInterpretations)
    .values({
      blueprint_id: blueprintId,
      interpretation: payload.interpretation,
      key_insights: payload.keyInsights,
      current_focus: payload.currentFocus,
      next_milestone: payload.nextMilestone,
      risk_flags: payload.riskFlags,
      confidence_tier: payload.confidenceTier,
      world_state_version: stateVersion,
      generated_at: generatedAt,
      expires_at: expiresAt,
    })
    .onConflictDoUpdate({
      target: blueprintInterpretations.blueprint_id,
      set: {
        interpretation: payload.interpretation,
        key_insights: payload.keyInsights,
        current_focus: payload.currentFocus,
        next_milestone: payload.nextMilestone,
        risk_flags: payload.riskFlags,
        confidence_tier: payload.confidenceTier,
        world_state_version: stateVersion,
        generated_at: generatedAt,
        expires_at: expiresAt,
      },
    });

  return { ...payload, generatedAt, expiresAt };
}

export async function countActiveOrders(blueprintId: string): Promise<number> {
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.blueprint_id, blueprintId), eq(orders.status, "active")));
  return rows.length;
}
