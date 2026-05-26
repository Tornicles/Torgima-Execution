export type TokenCategory =
  | "retrieval"
  | "prompt"
  | "memory"
  | "tool"
  | "reasoning"
  | "reflection"
  | "simulation";

export interface TokenAllocation {
  total: number;
  categories: Record<TokenCategory, number>;
}

const PROTECTED_MEMORY_TYPES = new Set([
  "signals",
  "conditions",
  "governance",
  "identity",
]);

export class TokenEconomy {
  allocate(maxTokens: number, options: { memory?: boolean; simulation?: boolean }): TokenAllocation {
    const categories: Record<TokenCategory, number> = {
      retrieval: Math.floor(maxTokens * 0.1),
      prompt: Math.floor(maxTokens * 0.35),
      memory: options.memory ? Math.floor(maxTokens * 0.2) : 0,
      tool: Math.floor(maxTokens * 0.1),
      reasoning: Math.floor(maxTokens * 0.15),
      reflection: Math.floor(maxTokens * 0.05),
      simulation: options.simulation ? Math.floor(maxTokens * 0.05) : 0,
    };

    const sum = Object.values(categories).reduce((a, b) => a + b, 0);
    if (sum > maxTokens) {
      const scale = maxTokens / sum;
      for (const k of Object.keys(categories) as TokenCategory[]) {
        categories[k] = Math.floor(categories[k]! * scale);
      }
    }

    return { total: maxTokens, categories };
  }

  canDeleteMemoryType(memoryType: string): boolean {
    return !PROTECTED_MEMORY_TYPES.has(memoryType.toLowerCase());
  }

  compressRatio(tier: "lossless" | "semantic" | "hierarchical" | "episodic"): number {
    const ratios = { lossless: 1, semantic: 0.7, hierarchical: 0.5, episodic: 0.35 };
    return ratios[tier];
  }
}

export const tokenEconomy = new TokenEconomy();
