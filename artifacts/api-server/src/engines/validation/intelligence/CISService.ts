import type { BlueprintTier } from "../../blueprint/infrastructure/blueprint-types.js";
import type { CISContext, IndustryClassification } from "./validation-intelligence-types.js";

export function buildCISContext(params: {
  blueprintId: string;
  userId: string;
  classification: IndustryClassification;
  tier: BlueprintTier;
  mode: string;
  commitmentLevel?: string;
  currentContext?: string;
}): CISContext {
  return {
    blueprintId: params.blueprintId,
    userId: params.userId,
    domain: params.classification.domain,
    industry: params.classification.industry,
    niche: params.classification.niche,
    systemState: "pre_execution_validation",
    executionContext: [
      `Industry: ${params.classification.industry}`,
      `Niche: ${params.classification.niche}`,
      `Domain: ${params.classification.domain}`,
      params.commitmentLevel ? `Commitment: ${params.commitmentLevel}` : null,
      params.currentContext ? `Context: ${params.currentContext.slice(0, 200)}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    tier: params.tier,
    mode: params.mode,
  };
}
