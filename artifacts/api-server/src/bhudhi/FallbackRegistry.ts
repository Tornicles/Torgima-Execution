import { getAllContracts } from "./PromptRegistry.js";
import { getFallback, hasFallbackKey } from "./FallbackLibrary.js";
import type { BhudhiOutputEnvelope } from "../types/bhudhi.js";
import { validateOutput } from "./OutputValidator.js";

/** Prompt 4 — registry of deterministic fallbacks for every registered contract. */
export function listRegisteredFallbackKeys(): string[] {
  const keys = new Set<string>();
  for (const contract of getAllContracts().values()) {
    keys.add(contract.fallbackKey);
  }
  return [...keys];
}

export function getDeterministicFallback(
  fallbackKey: string,
  ctx: Record<string, unknown>,
  stateVersion: number,
): BhudhiOutputEnvelope {
  return getFallback(fallbackKey, ctx, stateVersion);
}

export function validateFallbackForContract(
  triggerType: string,
  fallbackKey: string,
  ctx: Record<string, unknown>,
  stateVersion: number,
): { ok: boolean; errors: string[] } {
  const contracts = getAllContracts();
  const contract = contracts.get(triggerType as never);
  if (!contract) return { ok: false, errors: ["unknown trigger"] };

  const output = getFallback(fallbackKey, ctx, stateVersion);
  const validation = validateOutput(output, contract.outputType, stateVersion);
  return { ok: validation.ok, errors: validation.errors };
}

export function getFallbackCoverageReport(): {
  total: number;
  covered: number;
  keys: string[];
  missing: string[];
} {
  const contracts = [...getAllContracts().values()];
  const missing: string[] = [];
  let covered = 0;
  for (const c of contracts) {
    if (hasFallbackKey(c.fallbackKey)) covered++;
    else missing.push(`${c.triggerType}:${c.fallbackKey}`);
  }
  return {
    total: contracts.length,
    covered,
    keys: contracts.map(c => c.fallbackKey),
    missing,
  };
}
