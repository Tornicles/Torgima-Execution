import { db, criticReviewLogs } from "@workspace/db";
import { validateOutput } from "../OutputValidator.js";
import { validateOutputLayers } from "../OutputValidatorLayers.js";
import { getContract } from "../PromptRegistry.js";
import { getActiveAgentsForTrigger } from "../AgentRegistry.js";
import type { BhudhiTriggerType } from "../../types/bhudhi.js";

export interface CriticReviewInput {
  output: unknown;
  producingAgent: string;
  triggerType: BhudhiTriggerType | string;
  promptContract: string;
  userId: string;
  worldStateVersion: number;
  bhudhiLogId?: string;
}

export interface CriticReviewResult {
  verdict: "APPROVED" | "REJECTED" | "APPROVED_WITH_FLAG";
  confidenceScore: number;
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  output: unknown;
  rejectionReason?: string;
  flagReason?: string;
  governanceViolation: boolean;
  violationDetail?: string;
  revisionsRequired: boolean;
}

function detectGovernanceViolation(raw: unknown): { violated: boolean; detail?: string } {
  const text = JSON.stringify(raw).toLowerCase();
  if (text.includes("set_condition") || text.includes("assign condition") || text.includes("condition is now")) {
    return { violated: true, detail: "Output claims to set or assign system condition" };
  }
  if (text.includes("write_signal") || text.includes("signal has been set") || text.includes("override_signal")) {
    return { violated: true, detail: "Output claims to write signal values" };
  }
  if (
    text.includes("approve_blueprint") ||
    text.includes("blueprint is activated") ||
    text.includes("phase complete") ||
    text.includes("i have approved")
  ) {
    return { violated: true, detail: "Output claims blueprint/phase authority" };
  }
  if (text.includes("governance_queue") && text.includes("applied")) {
    return { violated: true, detail: "Output claims direct governance mutation" };
  }
  return { violated: false };
}

export async function reviewOutput(input: CriticReviewInput): Promise<CriticReviewResult> {
  const contract = getContract(input.triggerType as BhudhiTriggerType);
  const outputType = contract?.outputType ?? "state_explanation";

  const gov = detectGovernanceViolation(input.output);
  if (gov.violated) {
    return buildResult({
      verdict: "REJECTED",
      output: input.output,
      governanceViolation: true,
      violationDetail: gov.detail,
      rejectionReason: gov.detail,
      confidenceScore: 0.1,
      confidenceTier: "LOW",
    });
  }

  const envelope = input.output as Record<string, unknown>;
  if (envelope?.forbiddenActionRequested === true) {
    return buildResult({
      verdict: "REJECTED",
      output: input.output,
      governanceViolation: true,
      violationDetail: "forbiddenActionRequested=true",
      rejectionReason: "Forbidden action requested in envelope",
      confidenceScore: 0,
      confidenceTier: "LOW",
    });
  }

  const schema = validateOutput(input.output, outputType, input.worldStateVersion);
  if (!schema.ok) {
    return buildResult({
      verdict: "REJECTED",
      output: input.output,
      rejectionReason: `schema: ${schema.errors.join("; ")}`,
      confidenceScore: 0.2,
      confidenceTier: "LOW",
    });
  }

  const layers = await validateOutputLayers({
    raw: input.output,
    expectedType: outputType,
    expectedStateVersion: input.worldStateVersion,
    userId: input.userId,
    promptContract: input.promptContract,
  });

  if (!layers.passed) {
    const isGov =
      layers.failLayer === "forbidden_action" || layers.failLayer === "authority_claim";
    return buildResult({
      verdict: "REJECTED",
      output: input.output,
      governanceViolation: isGov,
      violationDetail: layers.failReason,
      rejectionReason: layers.failReason,
      confidenceScore: 0.25,
      confidenceTier: "LOW",
    });
  }

  let confidenceTier = layers.confidenceTier;
  let flagReason: string | undefined;
  if (confidenceTier === "LOW") {
    flagReason = "Low confidence — treat as provisional";
  }

  const confidenceScore =
    confidenceTier === "HIGH" ? 0.85 : confidenceTier === "MEDIUM" ? 0.6 : 0.35;

  const verdict: CriticReviewResult["verdict"] =
    flagReason ? "APPROVED_WITH_FLAG" : "APPROVED";

  const result = buildResult({
    verdict,
    output: input.output,
    confidenceScore,
    confidenceTier,
    flagReason,
    governanceViolation: false,
  });

  if (input.bhudhiLogId) {
    await persistCriticReview(input, result).catch(() => null);
  }

  return result;
}

function buildResult(p: Partial<CriticReviewResult> & { verdict: CriticReviewResult["verdict"] }): CriticReviewResult {
  return {
    verdict: p.verdict,
    confidenceScore: p.confidenceScore ?? 0.5,
    confidenceTier: p.confidenceTier ?? "MEDIUM",
    output: p.output,
    rejectionReason: p.rejectionReason,
    flagReason: p.flagReason,
    governanceViolation: p.governanceViolation ?? false,
    violationDetail: p.violationDetail,
    revisionsRequired: p.verdict === "REJECTED",
  };
}

async function persistCriticReview(input: CriticReviewInput, result: CriticReviewResult): Promise<void> {
  const agents = getActiveAgentsForTrigger(input.triggerType);
  const inputAgent = agents[0] ?? input.producingAgent;

  await db.insert(criticReviewLogs).values({
    bhudhi_log_id: input.bhudhiLogId!,
    user_id: input.userId,
    input_agent: inputAgent,
    verdict: result.verdict,
    confidence_score: result.confidenceScore,
    confidence_tier: result.confidenceTier,
    rejection_reason: result.rejectionReason,
    flag_reason: result.flagReason,
    governance_violation: result.governanceViolation,
    violation_detail: result.violationDetail,
    revision_count: result.revisionsRequired ? 1 : 0,
  });
}
