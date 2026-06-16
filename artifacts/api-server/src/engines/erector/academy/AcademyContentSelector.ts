import { eq } from "drizzle-orm";
import { db, erectorCapabilityGraph } from "@workspace/db";
import type { AcademyContentSpec, LearningType } from "./types.js";

export function determineLearningType(condition: string | null | undefined): LearningType {
  const normalized = (condition ?? "stability").toLowerCase();
  if (normalized === "danger" || normalized === "urgency") return "CORRECTION_LEARNING";
  if (normalized === "power") return "REINFORCEMENT_LEARNING";
  if (normalized === "affluence") return "SCALING_KNOWLEDGE";
  return "CAPABILITY_ACTIVATION";
}

function tierComplexity(tier: string): "starter" | "growth" | "ultimate" {
  if (tier === "ultimate") return "ultimate";
  if (tier === "growth" || tier === "pro") return "growth";
  return "starter";
}

function buildExecutionRequirement(
  capability: typeof erectorCapabilityGraph.$inferSelect,
  domain: string,
  phase: string,
): string {
  return `Apply ${capability.capability_name} in ${domain} during ${phase} with proof: ${capability.proof_required}`;
}

export async function loadCapabilityGraphNode(capabilityId: string) {
  const [capability] = await db
    .select()
    .from(erectorCapabilityGraph)
    .where(eq(erectorCapabilityGraph.capability_id, capabilityId))
    .limit(1);
  return capability ?? null;
}

export async function selectAcademyContent(input: {
  capabilityId: string;
  learningType: LearningType;
  domain: string;
  phase: string;
  tier: string;
  condition?: string | null;
}): Promise<AcademyContentSpec> {
  const capability = await loadCapabilityGraphNode(input.capabilityId);
  if (!capability) {
    throw new Error(`Capability graph node not found: ${input.capabilityId}`);
  }

  const tierLevel = tierComplexity(input.tier);
  const phaseRelevant =
    capability.phase_relevance.length === 0 ||
    capability.phase_relevance.some(
      (phaseName) => phaseName.toLowerCase() === input.phase.toLowerCase(),
    );

  const scopePrefix =
    input.learningType === "CORRECTION_LEARNING"
      ? "Essential recovery focus"
      : tierLevel === "starter"
        ? "Starter execution focus"
        : tierLevel === "ultimate"
          ? "Advanced execution focus"
          : "Execution focus";

  const executionRequirement = buildExecutionRequirement(
    capability,
    input.domain,
    phaseRelevant ? input.phase : "current phase",
  );

  return {
    title: `${scopePrefix}: ${capability.capability_name}`,
    explanation: `${capability.capability_description} You must produce execution proof, not passive study.`,
    learning_content: [
      `Capability: ${capability.capability_name}`,
      `Domain: ${input.domain}`,
      `Phase: ${input.phase}`,
      `Learning mode: ${input.learningType}`,
      `Required proof: ${capability.proof_required}`,
    ].join("\n"),
    execution_task_description: executionRequirement,
    proof_description: capability.proof_required,
    evidence_types_allowed: capability.evidence_types_allowed,
  };
}
