import type { IndustryClassification } from "./validation-intelligence-types.js";

const TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const industryCache = new Map<string, CacheEntry<IndustryClassification>>();

function cacheKey(goal: string, purpose?: string, domainHint?: string | null): string {
  return `${goal.trim().toLowerCase()}|${(purpose ?? "").trim().toLowerCase()}|${domainHint ?? ""}`;
}

export function getCachedIndustryClassification(
  goal: string,
  purpose?: string,
  domainHint?: string | null,
): IndustryClassification | null {
  const key = cacheKey(goal, purpose, domainHint);
  const hit = industryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    industryCache.delete(key);
    return null;
  }
  return hit.value;
}

export function setCachedIndustryClassification(
  goal: string,
  purpose: string | undefined,
  domainHint: string | null | undefined,
  classification: IndustryClassification,
): void {
  const key = cacheKey(goal, purpose, domainHint);
  industryCache.set(key, { value: classification, expiresAt: Date.now() + TTL_MS });
}

export function clearValidationCache(): void {
  industryCache.clear();
}
