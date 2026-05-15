import { z } from "zod/v4";

const baseObject = {
  title: z.string().min(1).max(500),
  purpose: z.string().max(2000).optional(),
  linkedTargetId: z.string().uuid().optional(),
  dependencies: z.array(z.string()).default([]),
  proofRequired: z.boolean().default(false),
  conditionInfluence: z.string().optional(),
  signalInfluence: z.string().optional(),
  executionType: z.string().optional(),
  strategicRole: z.string().optional(),
};

export const planContract = z.object({ ...baseObject, layer: z.literal("plan") });
export const targetContract = z.object({ ...baseObject, layer: z.literal("target"), type: z.string() });
export const phaseContract = z.object({ ...baseObject, layer: z.literal("phase"), name: z.string() });
export const projectContract = z.object({ ...baseObject, layer: z.literal("project"), projectType: z.string() });
export const actionContract = z.object({ ...baseObject, layer: z.literal("action"), actionType: z.string() });
export const orderContract = z.object({
  ...baseObject,
  layer: z.literal("order"),
  instruction: z.string().min(1),
  definitionOfDone: z.string().min(1),
  difficulty: z.string(),
});

const CONTRACTS = {
  plan: planContract,
  target: targetContract,
  phase: phaseContract,
  project: projectContract,
  action: actionContract,
  order: orderContract,
} as const;

export type GenerationLayer = keyof typeof CONTRACTS;

export function validateAIGeneratedObject(layer: GenerationLayer, data: unknown): {
  valid: boolean;
  data?: Record<string, unknown>;
  errors: string[];
} {
  const schema = CONTRACTS[layer];
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  return { valid: true, data: parsed.data as Record<string, unknown>, errors: [] };
}

export function rejectMalformedAIOutput(layer: GenerationLayer, data: unknown): Record<string, unknown> {
  const result = validateAIGeneratedObject(layer, data);
  if (!result.valid) {
    throw new Error(`[AIGenerationContracts] Malformed ${layer}: ${result.errors.join("; ")}`);
  }
  return result.data!;
}
