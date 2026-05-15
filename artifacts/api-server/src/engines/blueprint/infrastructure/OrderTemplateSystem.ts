import type { BlueprintTier } from "./blueprint-types.js";

export type OrderTemplateKind =
  | "execution"
  | "analysis"
  | "validation"
  | "distribution"
  | "recovery"
  | "optimization"
  | "coordination";

export interface OrderTemplate {
  kind: OrderTemplateKind;
  tier: BlueprintTier;
  tone: "guided" | "structured" | "strategic";
  intensity: "minimal" | "moderate" | "high";
  detailDepth: "low" | "medium" | "high";
  proofRequired: boolean;
  executionExpectation: string;
}

const TEMPLATES: OrderTemplate[] = [
  {
    kind: "execution",
    tier: "starter",
    tone: "guided",
    intensity: "minimal",
    detailDepth: "low",
    proofRequired: false,
    executionExpectation: "Complete one clear step with measurable output.",
  },
  {
    kind: "execution",
    tier: "growth",
    tone: "structured",
    intensity: "moderate",
    detailDepth: "medium",
    proofRequired: true,
    executionExpectation: "Execute with dependency awareness and signal-aligned pacing.",
  },
  {
    kind: "execution",
    tier: "ultimate",
    tone: "strategic",
    intensity: "high",
    detailDepth: "high",
    proofRequired: true,
    executionExpectation: "Execute with leverage awareness, fatigue guardrails, and strategic sequencing.",
  },
  {
    kind: "recovery",
    tier: "starter",
    tone: "guided",
    intensity: "minimal",
    detailDepth: "low",
    proofRequired: false,
    executionExpectation: "Stabilize execution — one recovery action only.",
  },
  {
    kind: "optimization",
    tier: "ultimate",
    tone: "strategic",
    intensity: "high",
    detailDepth: "high",
    proofRequired: true,
    executionExpectation: "Improve system leverage using signal and condition context.",
  },
  {
    kind: "coordination",
    tier: "growth",
    tone: "structured",
    intensity: "moderate",
    detailDepth: "medium",
    proofRequired: false,
    executionExpectation: "Coordinate dependent work across assigned targets.",
  },
];

export function getOrderTemplate(tier: BlueprintTier, kind: OrderTemplateKind): OrderTemplate {
  return (
    TEMPLATES.find((t) => t.tier === tier && t.kind === kind) ??
    TEMPLATES.find((t) => t.tier === tier && t.kind === "execution")!
  );
}

export function applyOrderTemplate(
  tier: BlueprintTier,
  kind: OrderTemplateKind,
  draft: { title: string; instruction: string },
): { title: string; instruction: string; proofRequired: boolean; templateId: string } {
  const tpl = getOrderTemplate(tier, kind);
  return {
    title: draft.title,
    instruction: `${draft.instruction}\n\nExpectation: ${tpl.executionExpectation}`,
    proofRequired: tpl.proofRequired,
    templateId: `${tier}:${kind}`,
  };
}
