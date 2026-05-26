import type { MemoryTier } from "../contracts/types.js";
import { tokenEconomy } from "../intelligence-budget/TokenEconomy.js";

export interface MemoryEconomicsResult {
  tier: MemoryTier;
  storageCostUsd: number;
  recallFrequency: number;
  compressionRatio: number;
  importance: number;
}

export class MemoryEconomics {
  classify(recallCount: number, ageDays: number, memoryType: string): MemoryEconomicsResult {
    const protectedType = !tokenEconomy.canDeleteMemoryType(memoryType);

    let tier: MemoryTier = "HOT";
    if (ageDays > 90) tier = protectedType ? "ARCHIVE" : "DELETE";
    else if (ageDays > 30) tier = "COLD";
    else if (ageDays > 7) tier = "WARM";

    if (recallCount > 50) tier = "HOT";
    else if (recallCount < 2 && ageDays > 14) tier = protectedType ? "ARCHIVE" : "COLD";

    const storageCostUsd = tier === "HOT" ? 0.002 : tier === "WARM" ? 0.001 : 0.0003;
    const compressionRatio =
      tier === "HOT" ? 1 : tier === "WARM" ? 0.85 : tokenEconomy.compressRatio("semantic");

    return {
      tier,
      storageCostUsd,
      recallFrequency: recallCount,
      compressionRatio,
      importance: protectedType ? 1 : Math.min(recallCount / 20, 1),
    };
  }
}

export const memoryEconomics = new MemoryEconomics();
