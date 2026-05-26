import type { SecurityChecks } from "./types.js";

export const MAX_BUDGET_IMPACT = 100_000;
export const MAX_RISK_PROBABILITY = 0.7;
export const MIN_ADOPTION_LIKELIHOOD = 0.5;

export const COMPLIANT_SYSTEM_TYPES = ["crm", "hrms", "data_platform"] as const;

export function isCompliantSystemType(systemType: string): boolean {
  return (COMPLIANT_SYSTEM_TYPES as readonly string[]).includes(systemType);
}

export interface RecommendationSecurityInput {
  expectedRevenue?: number;
  riskProbability?: number;
  adoptionLikelihood?: number;
  strategicallyAligned?: boolean;
}

export function evaluateRecommendationChecks(
  input: RecommendationSecurityInput,
  complianceOk: boolean,
): { valid: boolean; violations: string[]; checks: SecurityChecks } {
  const violations: string[] = [];

  const budgetOk = (input.expectedRevenue ?? 0) <= MAX_BUDGET_IMPACT;
  if (!budgetOk) {
    violations.push(
      `Budget exceeded: ${input.expectedRevenue} > ${MAX_BUDGET_IMPACT}`,
    );
  }

  const riskOk = (input.riskProbability ?? 0) <= MAX_RISK_PROBABILITY;
  if (!riskOk) {
    violations.push(
      `Risk level too high: ${input.riskProbability} > ${MAX_RISK_PROBABILITY}`,
    );
  }

  const adoptionOk =
    input.adoptionLikelihood === undefined ||
    input.adoptionLikelihood >= MIN_ADOPTION_LIKELIHOOD;
  if (!adoptionOk) {
    violations.push("Low adoption likelihood - change management required");
  }

  const alignmentOk = input.strategicallyAligned !== false;
  if (!alignmentOk) {
    violations.push("Not strategically aligned");
  }

  const complianceOkCheck = complianceOk;
  if (!complianceOkCheck) {
    violations.push("Compliance check failed");
  }

  return {
    valid: violations.length === 0,
    violations,
    checks: {
      budgetOk,
      riskOk,
      adoptionOk,
      alignmentOk,
      complianceOk: complianceOkCheck,
    },
  };
}

export function encryptDataBase64(data: unknown): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export function decryptDataBase64(encrypted: string): unknown {
  try {
    return JSON.parse(Buffer.from(encrypted, "base64").toString());
  } catch {
    return null;
  }
}
