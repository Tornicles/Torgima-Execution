import { z } from "zod/v4";

const PathSchema = z.object({
  type: z.enum(["current", "adjusted", "alternative"]).optional(),
  path_type: z.enum(["current", "adjusted", "alternative"]).optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  rationale: z.string().optional(),
  feasibility_score: z.number().optional(),
}).passthrough();

export const IntelligencePayloadSchema = z.object({
  verdict: z.enum(["proceed", "adjust", "pivot"]),
  paths: z.union([
    z.object({
      current: PathSchema,
      adjusted: PathSchema,
      alternative: PathSchema,
    }).passthrough(),
    z.array(PathSchema),
  ]),
  cis: z.object({}).passthrough().optional(),
  iis: z.object({}).passthrough().optional(),
  eis: z.object({}).passthrough().optional(),
  feasibility: z.object({}).passthrough().optional(),
  pis: z.object({}).passthrough().optional(),
  industryPanel: z.object({}).passthrough().optional(),
  systemsProgress: z.record(z.string(), z.enum(["pending", "running", "complete"])).optional(),
  readiness: z.string().optional(),
  launchBlocked: z.boolean().optional(),
}).passthrough();

export const ErectorPayloadSchema = z.object({
  erector: z.boolean().optional(),
  archetype: z.string().optional(),
  economy_type: z.string().optional(),
  erector_version: z.string().optional(),
  archetypeResolution: z.object({}).passthrough().optional(),
  scores: z.object({}).passthrough().optional(),
  economyBriefing: z.object({}).passthrough().optional(),
  systemsProgress: z.record(z.string(), z.enum(["pending", "running", "complete"])).optional(),
}).passthrough();

export const ValidationPayloadSchemas = {
  intelligence: IntelligencePayloadSchema,
  erector: ErectorPayloadSchema,
  legacy: z.object({}).passthrough(),
  readiness: z.object({}).passthrough(),
  path_selection: z.object({}).passthrough(),
  unknown: z.any(),
} satisfies Record<string, z.ZodType>;

export type ValidationKind = keyof typeof ValidationPayloadSchemas;

export function validatePayload(kind: string, payload: unknown) {
  const schema = ValidationPayloadSchemas[kind as ValidationKind] ?? z.any();
  return schema.safeParse(payload);
}
